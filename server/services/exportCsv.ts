import { stringify } from "csv-stringify/sync";

export interface LeadExportRow {
  username: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  followers_count: number;
  email_status: string;
}

export function leadsToCsv(rows: LeadExportRow[]): string {
  return stringify(rows, {
    header: true,
    columns: [
      "username",
      "full_name",
      "first_name",
      "last_name",
      "email",
      "phone",
      "location",
      "followers_count",
      "email_status",
    ],
  });
}

/** Meta Custom Audience format (email + optional phone). */
export function leadsToMetaAudienceCsv(
  rows: Array<{ email: string | null; phone: string | null; first_name?: string | null; last_name?: string | null }>
): string {
  const filtered = rows.filter((r) => r.email);
  return stringify(
    filtered.map((r) => ({
      email: r.email,
      phone: r.phone || "",
      fn: r.first_name || "",
      ln: r.last_name || "",
    })),
    { header: true, columns: ["email", "phone", "fn", "ln"] }
  );
}
