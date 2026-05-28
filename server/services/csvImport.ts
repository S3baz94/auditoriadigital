import { parse } from "csv-parse/sync";

export interface CsvLeadRow {
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  location?: string;
  followers_count?: string;
  following_count?: string;
}

const HEADER_ALIASES: Record<string, keyof CsvLeadRow> = {
  username: "username",
  user: "username",
  instagram: "username",
  handle: "username",
  full_name: "full_name",
  fullname: "full_name",
  name: "full_name",
  email: "email",
  mail: "email",
  phone: "phone",
  telefono: "phone",
  bio: "bio",
  biography: "bio",
  location: "location",
  city: "location",
  followers: "followers_count",
  followers_count: "followers_count",
  following: "following_count",
  following_count: "following_count",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseLeadsCsv(buffer: Buffer): CsvLeadRow[] {
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  if (!records.length) return [];

  const rawHeaders = Object.keys(records[0]);
  const mapping = new Map<string, keyof CsvLeadRow>();
  for (const h of rawHeaders) {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key) mapping.set(h, key);
  }

  const rows: CsvLeadRow[] = [];
  for (const rec of records) {
    const row: CsvLeadRow = { username: "" };
    for (const [raw, val] of Object.entries(rec)) {
      const field = mapping.get(raw);
      if (!field) continue;
      if (field === "username") row.username = val.replace(/^@/, "").trim();
      else row[field] = val.trim();
    }
    if (row.username) rows.push(row);
  }
  return rows;
}
