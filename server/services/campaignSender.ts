import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getDb } from "../db/index.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail: string;
}

export function createTransporter(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v != null ? String(v) : "";
  });
}

export function appendUnsubscribeFooter(html: string, leadId: string, baseUrl: string): string {
  const url = `${baseUrl}/api/track/unsubscribe/${leadId}`;
  const footer = `<p style="font-size:12px;color:#666;margin-top:24px">
    <a href="${url}">Cancelar suscripción</a> — solo datos públicos, cumple CAN-SPAM/GDPR.
  </p>`;
  return html + footer;
}

export async function verifySmtpConnection(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  const t = createTransporter(cfg);
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMTP verification failed" };
  }
}

let senderRunning = false;

export function isSenderRunning(): boolean {
  return senderRunning;
}

export async function processCampaignQueue(
  campaignId: string,
  baseUrl: string
): Promise<void> {
  if (senderRunning) return;
  senderRunning = true;
  const db = getDb();

  try {
    const campaign = db
      .prepare(
        `SELECT c.*, s.host, s.port, s.secure, s.user, s.pass, s.from_name, s.from_email, s.daily_limit, s.sent_today, s.last_reset_date, s.id as smtp_id
         FROM campaigns c
         LEFT JOIN smtp_accounts s ON s.id = c.smtp_account_id
         WHERE c.id = ?`
      )
      .get(campaignId) as Record<string, unknown> | undefined;

    if (!campaign || !campaign.host) return;

    const delay = Number(campaign.send_delay_ms) || 45000;
    const today = new Date().toISOString().slice(0, 10);
    let sentToday = Number(campaign.sent_today) || 0;
    if (campaign.last_reset_date !== today) sentToday = 0;

    const transporter = createTransporter({
      host: String(campaign.host),
      port: Number(campaign.port),
      secure: Boolean(campaign.secure),
      user: String(campaign.user),
      pass: String(campaign.pass),
      fromName: campaign.from_name ? String(campaign.from_name) : undefined,
      fromEmail: String(campaign.from_email),
    });

    const from = campaign.from_name
      ? `"${campaign.from_name}" <${campaign.from_email}>`
      : String(campaign.from_email);

    const queue = db
      .prepare(
        `SELECT cl.lead_id, l.email, l.first_name, l.last_name, l.username, l.full_name
         FROM campaign_leads cl
         JOIN leads l ON l.id = cl.lead_id
         WHERE cl.campaign_id = ? AND cl.status = 'queued' AND l.email IS NOT NULL AND l.email != ''
         ORDER BY cl.rowid`
      )
      .all(campaignId) as Array<{
      lead_id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      username: string;
      full_name: string | null;
    }>;

    db.prepare(`UPDATE campaigns SET status = 'sending', started_at = COALESCE(started_at, ?) WHERE id = ?`).run(
      new Date().toISOString(),
      campaignId
    );

    const dailyLimit = Number(campaign.daily_limit) || 200;

    for (const item of queue) {
      if (sentToday >= dailyLimit) {
        db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(campaignId);
        break;
      }

      const vars = {
        first_name: item.first_name || item.username,
        last_name: item.last_name || "",
        full_name: item.full_name || item.username,
        username: item.username,
        email: item.email,
      };

      let html = renderTemplate(String(campaign.body_html), vars);
      const text = campaign.body_text
        ? renderTemplate(String(campaign.body_text), vars)
        : undefined;

      if (campaign.include_unsubscribe) {
        html = appendUnsubscribeFooter(html, item.lead_id, baseUrl);
      }

      const trackPixel = `<img src="${baseUrl}/api/track/open/${campaignId}/${item.lead_id}" width="1" height="1" alt="" />`;
      html += trackPixel;

      const subject = renderTemplate(String(campaign.subject), vars);

      try {
        await transporter.sendMail({
          from,
          to: item.email,
          subject,
          html,
          text: text || undefined,
        });
        const now = new Date().toISOString();
        db.prepare(
          `UPDATE campaign_leads SET status = 'sent', sent_at = ? WHERE campaign_id = ? AND lead_id = ?`
        ).run(now, campaignId, item.lead_id);
        sentToday++;
        db.prepare(
          `UPDATE smtp_accounts SET sent_today = ?, last_reset_date = ? WHERE id = ?`
        ).run(sentToday, today, campaign.smtp_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "send_failed";
        db.prepare(
          `UPDATE campaign_leads SET status = 'failed', error_message = ? WHERE campaign_id = ? AND lead_id = ?`
        ).run(msg, campaignId, item.lead_id);
      }

      await new Promise((r) => setTimeout(r, delay));
    }

    const remaining = db
      .prepare(
        `SELECT COUNT(*) as c FROM campaign_leads WHERE campaign_id = ? AND status = 'queued'`
      )
      .get(campaignId) as { c: number };

    if (remaining.c === 0) {
      db.prepare(
        `UPDATE campaigns SET status = 'completed', completed_at = ? WHERE id = ?`
      ).run(new Date().toISOString(), campaignId);
    }
  } finally {
    senderRunning = false;
  }
}
