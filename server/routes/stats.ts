import { Router } from "express";
import { getDb } from "../db/index.js";

export const statsRouter = Router();

statsRouter.get("/dashboard", (_req, res) => {
  const db = getDb();
  const leads = db.prepare("SELECT COUNT(*) as c FROM leads").get() as { c: number };
  const withEmail = db
    .prepare(`SELECT COUNT(*) as c FROM leads WHERE email IS NOT NULL AND email != ''`)
    .get() as { c: number };
  const validEmail = db
    .prepare(`SELECT COUNT(*) as c FROM leads WHERE email_status = 'valid'`)
    .get() as { c: number };
  const jobs = db.prepare("SELECT COUNT(*) as c FROM scrape_jobs").get() as { c: number };
  const campaigns = db.prepare("SELECT COUNT(*) as c FROM campaigns").get() as { c: number };
  const sent = db
    .prepare(`SELECT COUNT(*) as c FROM campaign_leads WHERE status = 'sent'`)
    .get() as { c: number };

  res.json({
    total_leads: leads.c,
    leads_with_email: withEmail.c,
    valid_emails: validEmail.c,
    scrape_jobs: jobs.c,
    campaigns: campaigns.c,
    emails_sent: sent.c,
  });
});
