// Rutas API del flujo de diagnóstico.

import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { findNiche, findSize, getSurvey, NICHES, SIZES, type NicheCode, type SizeCode } from "../services/niches.js";
import { auditWebsite } from "../services/webAudit.js";
import { buildReport, type SurveyAnswers } from "../services/reportEngine.js";

export const diagnosticsRouter = Router();

// ── Metadata ──────────────────────────────────────────────────────────
diagnosticsRouter.get("/meta", (_req, res) => {
  res.json({ niches: NICHES, sizes: SIZES });
});

// ── Crear diagnóstico (paso 1) ────────────────────────────────────────
const startSchema = z.object({
  business_name: z.string().min(1, "Nombre requerido").max(200),
  website_url: z.string().min(3, "URL requerida").max(500),
  niche: z.string().min(1),
  size: z.string().min(1),
  geo: z.string().optional(),
});

diagnosticsRouter.post("/start", (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" });
    return;
  }
  const v = parsed.data;
  const nicheDef = findNiche(v.niche);
  const sizeDef = findSize(v.size);
  if (!nicheDef || !sizeDef) {
    res.status(400).json({ error: "Nicho o tamaño inválido" });
    return;
  }

  const id = nanoid();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO diagnostics (id, business_name, website_url, niche, size, geo, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'started', ?)`
  ).run(id, v.business_name, v.website_url, v.niche, v.size, v.geo ?? null, now);

  const survey = getSurvey(v.niche as NicheCode, v.size as SizeCode);
  res.json({ id, survey });
});

// ── Enviar respuestas y generar reporte (paso 2 → 3) ──────────────────
const surveySchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string())])),
});

diagnosticsRouter.post("/:id/survey", async (req, res) => {
  const id = req.params.id;
  const parsed = surveySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Respuestas inválidas" });
    return;
  }
  const db = getDb();
  const row = db.prepare(`SELECT * FROM diagnostics WHERE id = ?`).get(id) as
    | { id: string; website_url: string; niche: string; size: string }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "Diagnóstico no encontrado" });
    return;
  }

  const answers = parsed.data.answers as SurveyAnswers;

  // 1. Auditoría web (sincrónica)
  const audit = await auditWebsite(row.website_url);

  // 2. Reporte ejecutivo
  const report = buildReport(audit, answers, row.niche as NicheCode, row.size as SizeCode);

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE diagnostics
       SET survey_json = ?, audit_json = ?, report_json = ?,
           segment = ?, overall_score = ?, status = 'completed', completed_at = ?
       WHERE id = ?`
  ).run(
    JSON.stringify(answers),
    JSON.stringify(audit),
    JSON.stringify(report),
    report.segment,
    report.scores.overall,
    now,
    id
  );

  res.json({ id, audit, report });
});

// ── Obtener diagnóstico por id ────────────────────────────────────────
diagnosticsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM diagnostics WHERE id = ?`).get(req.params.id) as
    | {
        id: string;
        business_name: string;
        website_url: string;
        niche: string;
        size: string;
        geo: string | null;
        segment: string | null;
        overall_score: number | null;
        status: string;
        survey_json: string | null;
        audit_json: string | null;
        report_json: string | null;
        created_at: string;
        completed_at: string | null;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "Diagnóstico no encontrado" });
    return;
  }
  const safeParse = <T>(s: string | null): T | null => {
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  res.json({
    id: row.id,
    business_name: row.business_name,
    website_url: row.website_url,
    niche: row.niche,
    size: row.size,
    geo: row.geo,
    segment: row.segment,
    overall_score: row.overall_score,
    status: row.status,
    created_at: row.created_at,
    completed_at: row.completed_at,
    survey: safeParse(row.survey_json),
    audit: safeParse(row.audit_json),
    report: safeParse(row.report_json),
  });
});

// ── Listar diagnósticos ───────────────────────────────────────────────
diagnosticsRouter.get("/", (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, business_name, website_url, niche, size, segment, overall_score, status, created_at
         FROM diagnostics
        ORDER BY created_at DESC
        LIMIT 50`
    )
    .all();
  res.json({ diagnostics: rows });
});

// ── Borrar diagnóstico ────────────────────────────────────────────────
diagnosticsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM diagnostics WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
