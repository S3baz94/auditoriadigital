import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";
import { parseLeadsCsv } from "../services/csvImport.js";
import { verifyEmail } from "../services/emailVerify.js";
import { mergeWithFullName, parseNameFromUsername } from "../services/nameAi.js";
import { generateProspects, type SourceType } from "../services/mockProspect.js";
import { leadsToCsv, leadsToMetaAudienceCsv } from "../services/exportCsv.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const leadsRouter = Router();

leadsRouter.get("/", (req, res) => {
  const db = getDb();
  const { job_id, has_email, min_followers, email_status, q, limit = "100", offset = "0" } = req.query;

  let sql = "SELECT * FROM leads WHERE 1=1";
  const params: unknown[] = [];

  if (job_id) {
    sql += " AND job_id = ?";
    params.push(job_id);
  }
  if (has_email === "true") {
    sql += " AND email IS NOT NULL AND email != ''";
  }
  if (min_followers) {
    sql += " AND followers_count >= ?";
    params.push(Number(min_followers));
  }
  if (email_status) {
    sql += " AND email_status = ?";
    params.push(email_status);
  }
  if (q) {
    sql += " AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)";
    const term = `%${q}%`;
    params.push(term, term, term);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare("SELECT COUNT(*) as c FROM leads").get() as { c: number };
  res.json({ leads: rows, total: total.c });
});

leadsRouter.post("/scrape", async (req, res) => {
  const { source_type, source_value, limit = 50 } = req.body as {
    source_type?: SourceType;
    source_value?: string;
    limit?: number;
  };

  if (!source_type || !source_value?.trim()) {
    res.status(400).json({ error: "source_type and source_value are required" });
    return;
  }

  const allowed: SourceType[] = [
    "followers",
    "following",
    "likers",
    "commenters",
    "hashtag",
    "location",
  ];
  if (!allowed.includes(source_type)) {
    res.status(400).json({ error: "invalid source_type" });
    return;
  }

  const jobId = nanoid();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO scrape_jobs (id, source_type, source_value, status, created_at) VALUES (?, ?, ?, 'running', ?)`
  ).run(jobId, source_type, source_value.trim(), now);

  const prospects = generateProspects(source_type, source_value.trim(), Math.min(Number(limit) || 50, 500));
  const insert = db.prepare(
    `INSERT INTO leads (id, job_id, username, full_name, first_name, last_name, email, phone, bio, location, followers_count, following_count, is_verified, email_status, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let withEmail = 0;
  for (const p of prospects) {
    const parsed = mergeWithFullName(parseNameFromUsername(p.username), p.fullName);
    let emailStatus = "unknown";
    if (p.email) {
      const v = await verifyEmail(p.email);
      emailStatus = v.status;
      withEmail++;
    }
    insert.run(
      nanoid(),
      jobId,
      p.username,
      p.fullName,
      parsed.firstName,
      parsed.lastName,
      p.email,
      p.phone,
      p.bio,
      p.location,
      p.followersCount,
      p.followingCount,
      p.isVerified ? 1 : 0,
      emailStatus,
      source_type,
      now
    );
  }

  db.prepare(
    `UPDATE scrape_jobs SET status = 'completed', total_found = ?, completed_at = ? WHERE id = ?`
  ).run(prospects.length, new Date().toISOString(), jobId);

  res.json({
    job_id: jobId,
    total: prospects.length,
    with_email: withEmail,
    mode: "demo",
    note: "Demo data generator. Import real leads via CSV or connect a compliant API.",
  });
});

leadsRouter.get("/jobs", (_req, res) => {
  const db = getDb();
  const jobs = db
    .prepare("SELECT * FROM scrape_jobs ORDER BY created_at DESC LIMIT 50")
    .all();
  res.json({ jobs });
});

leadsRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "CSV file required (field: file)" });
    return;
  }

  const rows = parseLeadsCsv(req.file.buffer);
  if (!rows.length) {
    res.status(400).json({ error: "No valid rows in CSV" });
    return;
  }

  const jobId = nanoid();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO scrape_jobs (id, source_type, source_value, status, total_found, created_at, completed_at)
     VALUES (?, 'import', 'csv', 'completed', ?, ?, ?)`
  ).run(jobId, rows.length, now, now);

  const insert = db.prepare(
    `INSERT INTO leads (id, job_id, username, full_name, first_name, last_name, email, phone, bio, location, followers_count, following_count, is_verified, email_status, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'import', ?)`
  );

  let imported = 0;
  for (const r of rows) {
    const parsed = mergeWithFullName(parseNameFromUsername(r.username), r.full_name);
    let emailStatus = "unknown";
    if (r.email) {
      const v = await verifyEmail(r.email);
      emailStatus = v.status;
    }
    insert.run(
      nanoid(),
      jobId,
      r.username,
      r.full_name || null,
      parsed.firstName,
      parsed.lastName,
      r.email || null,
      r.phone || null,
      r.bio || null,
      r.location || null,
      Number(r.followers_count) || 0,
      Number(r.following_count) || 0,
      emailStatus,
      now
    );
    imported++;
  }

  res.json({ job_id: jobId, imported });
});

leadsRouter.post("/verify", async (req, res) => {
  const { lead_ids } = req.body as { lead_ids?: string[] };
  const db = getDb();
  let leads: Array<{ id: string; email: string }>;

  if (lead_ids?.length) {
    const placeholders = lead_ids.map(() => "?").join(",");
    leads = db
      .prepare(`SELECT id, email FROM leads WHERE id IN (${placeholders}) AND email IS NOT NULL`)
      .all(...lead_ids) as Array<{ id: string; email: string }>;
  } else {
    leads = db
      .prepare(`SELECT id, email FROM leads WHERE email IS NOT NULL AND email_status IN ('unknown', 'risky') LIMIT 100`)
      .all() as Array<{ id: string; email: string }>;
  }

  const update = db.prepare(`UPDATE leads SET email_status = ? WHERE id = ?`);
  const results = [];
  for (const l of leads) {
    const v = await verifyEmail(l.email);
    update.run(v.status, l.id);
    results.push({ id: l.id, email: l.email, status: v.status, reasons: v.reasons });
  }
  res.json({ verified: results.length, results });
});

leadsRouter.post("/enrich-names", (req, res) => {
  const { job_id } = req.body as { job_id?: string };
  const db = getDb();
  let sql = "SELECT id, username, full_name, first_name FROM leads WHERE (first_name IS NULL OR first_name = '')";
  const params: unknown[] = [];
  if (job_id) {
    sql += " AND job_id = ?";
    params.push(job_id);
  }
  sql += " LIMIT 500";
  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    username: string;
    full_name: string | null;
  }>;

  const update = db.prepare(
    `UPDATE leads SET first_name = ?, last_name = ? WHERE id = ?`
  );
  let enriched = 0;
  for (const r of rows) {
    const parsed = mergeWithFullName(parseNameFromUsername(r.username), r.full_name);
    if (parsed.firstName) {
      update.run(parsed.firstName, parsed.lastName, r.id);
      enriched++;
    }
  }
  res.json({ enriched });
});

leadsRouter.get("/export.csv", (req, res) => {
  const db = getDb();
  const { job_id, valid_only } = req.query;
  let sql = "SELECT username, full_name, first_name, last_name, email, phone, location, followers_count, email_status FROM leads WHERE 1=1";
  const params: unknown[] = [];
  if (job_id) {
    sql += " AND job_id = ?";
    params.push(job_id);
  }
  if (valid_only === "true") {
    sql += " AND email_status = 'valid'";
  }
  const rows = db.prepare(sql).all(...params) as Parameters<typeof leadsToCsv>[0];
  const csv = leadsToCsv(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
  res.send(csv);
});

leadsRouter.get("/export-meta.csv", (req, res) => {
  const db = getDb();
  const { job_id } = req.query;
  let sql =
    "SELECT email, phone, first_name, last_name FROM leads WHERE email IS NOT NULL AND email != ''";
  const params: unknown[] = [];
  if (job_id) {
    sql += " AND job_id = ?";
    params.push(job_id);
  }
  const rows = db.prepare(sql).all(...params);
  const csv = leadsToMetaAudienceCsv(rows as Parameters<typeof leadsToMetaAudienceCsv>[0]);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="meta-audience.csv"');
  res.send(csv);
});

leadsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
