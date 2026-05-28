import dns from "node:dns/promises";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
]);

export type EmailStatus = "valid" | "risky" | "invalid" | "unknown";

export interface VerifyResult {
  email: string;
  status: EmailStatus;
  reasons: string[];
  mxHosts: string[];
}

export function isValidSyntax(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export async function verifyEmail(email: string): Promise<VerifyResult> {
  const normalized = email.trim().toLowerCase();
  const reasons: string[] = [];
  const mxHosts: string[] = [];

  if (!isValidSyntax(normalized)) {
    return { email: normalized, status: "invalid", reasons: ["invalid_syntax"], mxHosts };
  }

  const [, domain] = normalized.split("@");
  if (!domain) {
    return { email: normalized, status: "invalid", reasons: ["missing_domain"], mxHosts };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    reasons.push("disposable_domain");
    return { email: normalized, status: "risky", reasons, mxHosts };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) {
      reasons.push("no_mx_records");
      return { email: normalized, status: "invalid", reasons, mxHosts };
    }
    mx.sort((a, b) => a.priority - b.priority);
    for (const r of mx) mxHosts.push(r.exchange);
  } catch {
    try {
      await dns.resolve4(domain);
      reasons.push("a_record_only_no_mx");
      return { email: normalized, status: "risky", reasons, mxHosts };
    } catch {
      reasons.push("domain_not_found");
      return { email: normalized, status: "invalid", reasons, mxHosts };
    }
  }

  if (normalized.includes("noreply") || normalized.startsWith("no-reply")) {
    reasons.push("noreply_address");
    return { email: normalized, status: "risky", reasons, mxHosts };
  }

  return { email: normalized, status: "valid", reasons: ["mx_ok"], mxHosts };
}

export async function verifyMany(
  emails: string[],
  concurrency = 5
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((e) => verifyEmail(e)));
    results.push(...batchResults);
  }
  return results;
}
