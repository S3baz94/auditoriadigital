import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";

export const trackRouter = Router();

trackRouter.get("/open/:campaignId/:leadId", (req, res) => {
  const db = getDb();
  const { campaignId, leadId } = req.params;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE campaign_leads SET opened_at = COALESCE(opened_at, ?) WHERE campaign_id = ? AND lead_id = ?`
  ).run(now, campaignId, leadId);

  db.prepare(
    `INSERT INTO email_events (id, campaign_id, lead_id, event_type, created_at) VALUES (?, ?, ?, 'open', ?)`
  ).run(nanoid(), campaignId, leadId, now);

  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store");
  res.send(pixel);
});

trackRouter.get("/click/:campaignId/:leadId", (req, res) => {
  const db = getDb();
  const { campaignId, leadId } = req.params;
  const target = req.query.url as string;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE campaign_leads SET clicked_at = COALESCE(clicked_at, ?) WHERE campaign_id = ? AND lead_id = ?`
  ).run(now, campaignId, leadId);

  db.prepare(
    `INSERT INTO email_events (id, campaign_id, lead_id, event_type, created_at) VALUES (?, ?, ?, 'click', ?)`
  ).run(nanoid(), campaignId, leadId, now);

  if (target && /^https?:\/\//i.test(target)) {
    res.redirect(target);
  } else {
    res.status(400).send("Invalid URL");
  }
});

trackRouter.get("/unsubscribe/:leadId", (req, res) => {
  const db = getDb();
  db.prepare(`UPDATE leads SET email_status = 'invalid' WHERE id = ?`).run(req.params.leadId);
  res.type("html").send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Baja</title></head>
    <body style="font-family:system-ui;max-width:480px;margin:80px auto;text-align:center">
      <h1>Listo</h1>
      <p>Te hemos dado de baja de futuros envíos.</p>
    </body></html>
  `);
});
