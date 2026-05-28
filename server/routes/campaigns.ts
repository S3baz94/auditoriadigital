import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";
import {
  isSenderRunning,
  processCampaignQueue,
  verifySmtpConnection,
} from "../services/campaignSender.js";

export const campaignsRouter = Router();

campaignsRouter.get("/smtp", (_req, res) => {
  const db = getDb();
  const accounts = db
    .prepare(
      `SELECT id, label, host, port, secure, user, from_name, from_email, daily_limit, sent_today, last_reset_date, is_active, created_at FROM smtp_accounts`
    )
    .all();
  res.json({ accounts });
});

campaignsRouter.post("/smtp", async (req, res) => {
  const body = req.body as {
    label?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from_name?: string;
    from_email?: string;
    daily_limit?: number;
  };

  if (!body.label || !body.host || !body.user || !body.pass || !body.from_email) {
    res.status(400).json({ error: "label, host, user, pass, from_email required" });
    return;
  }

  const cfg = {
    host: body.host,
    port: body.port ?? 587,
    secure: body.secure ?? false,
    user: body.user,
    pass: body.pass,
    fromName: body.from_name,
    fromEmail: body.from_email,
  };

  const check = await verifySmtpConnection(cfg);
  if (!check.ok) {
    res.status(400).json({ error: "SMTP connection failed", detail: check.error });
    return;
  }

  const id = nanoid();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO smtp_accounts (id, label, host, port, secure, user, pass, from_name, from_email, daily_limit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.label,
    body.host,
    cfg.port,
    cfg.secure ? 1 : 0,
    body.user,
    body.pass,
    body.from_name || null,
    body.from_email,
    body.daily_limit ?? 200,
    now
  );

  res.json({ id, verified: true });
});

campaignsRouter.get("/", (_req, res) => {
  const db = getDb();
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all();
  res.json({ campaigns, sender_running: isSenderRunning() });
});

campaignsRouter.post("/", (req, res) => {
  const {
    name,
    subject,
    body_html,
    body_text,
    smtp_account_id,
    send_delay_ms,
    lead_ids,
    job_id,
    valid_email_only,
  } = req.body as {
    name?: string;
    subject?: string;
    body_html?: string;
    body_text?: string;
    smtp_account_id?: string;
    send_delay_ms?: number;
    lead_ids?: string[];
    job_id?: string;
    valid_email_only?: boolean;
  };

  if (!name || !subject || !body_html || !smtp_account_id) {
    res.status(400).json({ error: "name, subject, body_html, smtp_account_id required" });
    return;
  }

  const db = getDb();
  const smtp = db.prepare("SELECT id FROM smtp_accounts WHERE id = ?").get(smtp_account_id);
  if (!smtp) {
    res.status(400).json({ error: "invalid smtp_account_id" });
    return;
  }

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO campaigns (id, name, subject, body_html, body_text, smtp_account_id, send_delay_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    subject,
    body_html,
    body_text || null,
    smtp_account_id,
    send_delay_ms ?? 45000,
    now
  );

  let leadRows: Array<{ id: string }>;
  if (lead_ids?.length) {
    const ph = lead_ids.map(() => "?").join(",");
    leadRows = db.prepare(`SELECT id FROM leads WHERE id IN (${ph})`).all(...lead_ids) as Array<{
      id: string;
    }>;
  } else {
    let sql = `SELECT id FROM leads WHERE email IS NOT NULL AND email != ''`;
    const params: unknown[] = [];
    if (job_id) {
      sql += " AND job_id = ?";
      params.push(job_id);
    }
    if (valid_email_only) {
      sql += " AND email_status = 'valid'";
    }
    sql += " LIMIT 500";
    leadRows = db.prepare(sql).all(...params) as Array<{ id: string }>;
  }

  const ins = db.prepare(
    `INSERT OR IGNORE INTO campaign_leads (campaign_id, lead_id, status) VALUES (?, ?, 'queued')`
  );
  for (const l of leadRows) ins.run(id, l.id);

  res.json({ id, leads_queued: leadRows.length });
});

campaignsRouter.post("/:id/start", (req, res) => {
  const baseUrl =
    (req.headers["x-forwarded-proto"]
      ? `${req.headers["x-forwarded-proto"]}://`
      : `${req.protocol}://`) +
    (req.headers["x-forwarded-host"] || req.get("host"));

  const campaignId = req.params.id;
  processCampaignQueue(campaignId, baseUrl).catch(console.error);
  res.json({ started: true, campaign_id: campaignId });
});

campaignsRouter.get("/:id/stats", (req, res) => {
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const stats = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM campaign_leads WHERE campaign_id = ? GROUP BY status`
    )
    .all(req.params.id);
  res.json({ campaign, stats });
});

campaignsRouter.get("/:id/leads", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cl.*, l.username, l.email, l.first_name
       FROM campaign_leads cl
       JOIN leads l ON l.id = cl.lead_id
       WHERE cl.campaign_id = ?
       ORDER BY cl.sent_at DESC`
    )
    .all(req.params.id);
  res.json({ leads: rows });
});
