import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { buildAuditReport, type AuditAnswersMap } from "../services/auditEngine.js";

export const auditsRouter = Router();

const createAuditSchema = z.object({
  business_name: z.string().min(1),
  industry: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().min(1).default("USD"),
  website_url: z.string().url().optional().or(z.literal("")),
  instagram_url: z.string().url().optional().or(z.literal("")),
  facebook_url: z.string().url().optional().or(z.literal("")),
  tiktok_url: z.string().url().optional().or(z.literal("")),
  linkedin_url: z.string().url().optional().or(z.literal("")),
  youtube_url: z.string().url().optional().or(z.literal("")),
  google_business_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

auditsRouter.get("/", (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, r.overall_score
       FROM audits a
       LEFT JOIN audit_reports r ON r.audit_id = a.id
       ORDER BY a.created_at DESC
       LIMIT 50`
    )
    .all();
  res.json({ audits: rows });
});

auditsRouter.post("/", (req, res) => {
  const parsed = createAuditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const db = getDb();
  const now = new Date().toISOString();
  const id = nanoid();
  const v = parsed.data;

  db.prepare(
    `INSERT INTO audits (
      id, status, business_name, industry, country, currency,
      website_url, instagram_url, facebook_url, tiktok_url, linkedin_url, youtube_url, google_business_url,
      notes, created_at, updated_at
    ) VALUES (
      @id, 'draft', @business_name, @industry, @country, @currency,
      @website_url, @instagram_url, @facebook_url, @tiktok_url, @linkedin_url, @youtube_url, @google_business_url,
      @notes, @created_at, @updated_at
    )`
  ).run({
    id,
    business_name: v.business_name,
    industry: v.industry || null,
    country: v.country || null,
    currency: v.currency || "USD",
    website_url: v.website_url || null,
    instagram_url: v.instagram_url || null,
    facebook_url: v.facebook_url || null,
    tiktok_url: v.tiktok_url || null,
    linkedin_url: v.linkedin_url || null,
    youtube_url: v.youtube_url || null,
    google_business_url: v.google_business_url || null,
    notes: v.notes || null,
    created_at: now,
    updated_at: now,
  });

  res.json({ id });
});

const upsertSectionSchema = z.object({
  section: z.string().min(1),
  answers: z.record(z.any()),
});

auditsRouter.put("/:id/answers", (req, res) => {
  const id = req.params.id;
  const parsed = upsertSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO audit_answers (audit_id, section, answers_json, created_at, updated_at)
     VALUES (@audit_id, @section, @answers_json, @created_at, @updated_at)
     ON CONFLICT(audit_id, section) DO UPDATE SET
       answers_json = excluded.answers_json,
       updated_at = excluded.updated_at`
  ).run({
    audit_id: id,
    section: parsed.data.section,
    answers_json: JSON.stringify(parsed.data.answers ?? {}),
    created_at: now,
    updated_at: now,
  });

  db.prepare(`UPDATE audits SET updated_at = @now WHERE id = @id`).run({ now, id });
  res.json({ ok: true });
});

auditsRouter.get("/:id/report", (req, res) => {
  const id = req.params.id;
  const db = getDb();

  const audit = db.prepare(`SELECT * FROM audits WHERE id = ?`).get(id);
  if (!audit) return res.status(404).json({ error: "Audit not found" });

  const sections = db
    .prepare(`SELECT section, answers_json FROM audit_answers WHERE audit_id = ?`)
    .all(id) as Array<{ section: string; answers_json: string }>;

  const answers: AuditAnswersMap = {};
  for (const s of sections) {
    try {
      (answers as Record<string, unknown>)[s.section] = JSON.parse(s.answers_json || "{}");
    } catch {
      (answers as Record<string, unknown>)[s.section] = {};
    }
  }

  const report = buildAuditReport(answers);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_reports (audit_id, overall_score, scores_json, financials_json, recommendations_json, created_at, updated_at)
     VALUES (@audit_id, @overall_score, @scores_json, @financials_json, @recommendations_json, @created_at, @updated_at)
     ON CONFLICT(audit_id) DO UPDATE SET
       overall_score = excluded.overall_score,
       scores_json = excluded.scores_json,
       financials_json = excluded.financials_json,
       recommendations_json = excluded.recommendations_json,
       updated_at = excluded.updated_at`
  ).run({
    audit_id: id,
    overall_score: report.overall_score,
    scores_json: JSON.stringify(report.scores),
    financials_json: JSON.stringify(report.financials),
    recommendations_json: JSON.stringify(report.recommendations),
    created_at: now,
    updated_at: now,
  });

  res.json({ audit, report, answers: answers as Record<string, Record<string, unknown>> });
});

