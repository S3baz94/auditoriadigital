// Motor de análisis web automático.
// Fetchea el sitio, parsea HTML y detecta tech, SEO, tracking,
// canales de conversión, redes y e-commerce — sin librerías externas
// para mantener el bundle de Vercel chico.

export interface WebAuditResult {
  url: string;
  final_url: string;
  reachable: boolean;
  https: boolean;
  status_code: number | null;
  response_time_ms: number | null;

  // SEO básico
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  language: string | null;
  has_viewport_meta: boolean;
  has_favicon: boolean;

  // Open Graph
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;

  // Datos estructurados
  has_schema_org: boolean;
  schema_types: string[];

  // Tracking y analítica
  has_google_analytics: boolean;
  has_gtm: boolean;
  has_meta_pixel: boolean;
  has_tiktok_pixel: boolean;
  has_linkedin_insight: boolean;
  has_hotjar: boolean;
  has_clarity: boolean;

  // Stack y plataforma
  cms: string | null;
  has_chat_widget: boolean;
  chat_widget: string | null;

  // Conversión
  has_forms: boolean;
  has_phone: boolean;
  phones: string[];
  has_email: boolean;
  emails: string[];
  has_whatsapp: boolean;
  whatsapp_links: string[];

  // E-commerce
  has_ecommerce: boolean;

  // Redes encontradas en el sitio
  social_links: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    youtube: string | null;
    linkedin: string | null;
    twitter: string | null;
  };

  // PageSpeed (solo si hay PAGESPEED_API_KEY)
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;

  errors: string[];
}

const FETCH_TIMEOUT = 12_000;
const UA = "Mozilla/5.0 (compatible; DiagBot/1.0; +https://diag.app)";

export function normalizeUrl(url: string): string {
  const t = (url ?? "").trim();
  if (!t) return "";
  const withScheme = /^https?:\/\//i.test(t) ? t : "https://" + t;
  return withScheme.replace(/\/$/, "");
}

function empty(url: string): WebAuditResult {
  return {
    url,
    final_url: url,
    reachable: false,
    https: url.startsWith("https://"),
    status_code: null,
    response_time_ms: null,
    title: null,
    meta_description: null,
    canonical: null,
    language: null,
    has_viewport_meta: false,
    has_favicon: false,
    og_title: null,
    og_description: null,
    og_image: null,
    has_schema_org: false,
    schema_types: [],
    has_google_analytics: false,
    has_gtm: false,
    has_meta_pixel: false,
    has_tiktok_pixel: false,
    has_linkedin_insight: false,
    has_hotjar: false,
    has_clarity: false,
    cms: null,
    has_chat_widget: false,
    chat_widget: null,
    has_forms: false,
    has_phone: false,
    phones: [],
    has_email: false,
    emails: [],
    has_whatsapp: false,
    whatsapp_links: [],
    has_ecommerce: false,
    social_links: {
      instagram: null,
      facebook: null,
      tiktok: null,
      youtube: null,
      linkedin: null,
      twitter: null,
    },
    performance_score: null,
    seo_score: null,
    accessibility_score: null,
    best_practices_score: null,
    errors: [],
  };
}

export async function auditWebsite(rawUrl: string): Promise<WebAuditResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    const r = empty(rawUrl ?? "");
    r.errors.push("URL vacía");
    return r;
  }

  const result = empty(url);
  const start = Date.now();

  let response: Response;
  let html = "";
  try {
    response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    result.response_time_ms = Date.now() - start;
    result.status_code = response.status;
    result.final_url = response.url || url;
    result.https = (response.url || url).startsWith("https://");
    result.reachable = response.ok;
    if (!response.ok) {
      result.errors.push(`HTTP ${response.status}`);
      return result;
    }
    html = await response.text();
  } catch (e) {
    result.errors.push(`Red: ${e instanceof Error ? e.message : "error desconocido"}`);
    return result;
  }

  parseSeo(html, result);
  parseOpenGraph(html, result);
  parseStructuredData(html, result);
  detectTracking(html, result);
  detectCms(html, response.headers, result);
  detectChatWidget(html, result);
  parseContactInfo(html, result);
  parseSocialLinks(html, result);
  detectEcommerce(html, result);

  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) {
    try {
      const ps = await fetchPageSpeed(url, apiKey);
      if (ps) {
        result.performance_score = ps.performance;
        result.seo_score = ps.seo;
        result.accessibility_score = ps.accessibility;
        result.best_practices_score = ps.best_practices;
      }
    } catch (e) {
      result.errors.push(`PageSpeed: ${e instanceof Error ? e.message : "fallo"}`);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseSeo(html: string, r: WebAuditResult): void {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) r.title = cleanText(title[1]);

  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (desc) r.meta_description = cleanText(desc[1]);

  r.has_viewport_meta = /<meta[^>]+name=["']viewport["']/i.test(html);
  r.has_favicon = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i.test(html);

  const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  if (canon) r.canonical = canon[1];

  const lang = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
  if (lang) r.language = lang[1];
}

function parseOpenGraph(html: string, r: WebAuditResult): void {
  const og = (prop: string): string | null => {
    const m =
      html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, "i"));
    return m ? cleanText(m[1]) : null;
  };
  r.og_title = og("title");
  r.og_description = og("description");
  r.og_image = og("image");
}

function parseStructuredData(html: string, r: WebAuditResult): void {
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const types = new Set<string>();
  let found = false;
  for (const m of matches) {
    found = true;
    try {
      const json = JSON.parse(m[1]);
      const collect = (obj: unknown): void => {
        if (Array.isArray(obj)) {
          obj.forEach(collect);
        } else if (obj && typeof obj === "object") {
          const o = obj as Record<string, unknown>;
          const t = o["@type"];
          if (typeof t === "string") types.add(t);
          else if (Array.isArray(t)) (t as string[]).forEach((x) => types.add(x));
          if (Array.isArray(o["@graph"])) (o["@graph"] as unknown[]).forEach(collect);
        }
      };
      collect(json);
    } catch {
      // ignorar JSON inválido
    }
  }
  r.has_schema_org = found;
  r.schema_types = Array.from(types);
}

function detectTracking(html: string, r: WebAuditResult): void {
  r.has_google_analytics =
    /gtag\(['"]config['"]\s*,\s*['"](?:UA|G-|GT-)/i.test(html) ||
    /googletagmanager\.com\/gtag\/js/i.test(html) ||
    /google-analytics\.com\/(?:analytics|ga)\.js/i.test(html) ||
    /UA-\d+-\d+/.test(html) ||
    /G-[A-Z0-9]{8,}/.test(html);

  r.has_gtm = /googletagmanager\.com\/gtm\.js/i.test(html) || /GTM-[A-Z0-9]+/.test(html);

  r.has_meta_pixel =
    /connect\.facebook\.net.*fbevents\.js/i.test(html) ||
    /fbq\(['"]init['"]/i.test(html) ||
    /facebook\.com\/tr\?id=/i.test(html);

  r.has_tiktok_pixel = /analytics\.tiktok\.com\/i18n\/pixel/i.test(html) || /ttq\.load/i.test(html);

  r.has_linkedin_insight =
    /snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/i.test(html) ||
    /_linkedin_partner_id/i.test(html);

  r.has_hotjar = /static\.hotjar\.com/i.test(html) || /hjid:\s*\d+/i.test(html);
  r.has_clarity = /clarity\.ms\/tag/i.test(html) || /clarity\(['"]/i.test(html);
}

function detectCms(html: string, headers: Headers, r: WebAuditResult): void {
  const lower = html.toLowerCase();
  if (lower.includes("wp-content") || lower.includes("wp-includes") || lower.includes("/wp-json/")) {
    r.cms = "WordPress";
  } else if (lower.includes("cdn.shopify.com") || lower.includes("shopify.theme") || lower.includes("shopify-features")) {
    r.cms = "Shopify";
  } else if (lower.includes("wix.com") || lower.includes("parastorage.com")) {
    r.cms = "Wix";
  } else if (lower.includes("squarespace.com") || lower.includes("squarespace-cdn.com")) {
    r.cms = "Squarespace";
  } else if (lower.includes("assets.webflow.com") || lower.includes("webflow.io")) {
    r.cms = "Webflow";
  } else if (lower.includes("hs-scripts.com") || lower.includes("hsforms.com")) {
    r.cms = "HubSpot";
  } else if (lower.includes("ghost.org") || lower.includes("/ghost/")) {
    r.cms = "Ghost";
  } else if (lower.includes("drupal-settings-json")) {
    r.cms = "Drupal";
  } else if (lower.includes("/joomla")) {
    r.cms = "Joomla";
  } else if (lower.includes("tiendanube") || lower.includes("nuvemshop")) {
    r.cms = "Tiendanube";
  }
  if (!r.cms) {
    const xPoweredBy = headers.get("x-powered-by");
    if (xPoweredBy?.toLowerCase().includes("next.js")) r.cms = "Next.js";
    else if (xPoweredBy?.toLowerCase().includes("php")) r.cms = "PHP (custom)";
  }
}

function detectChatWidget(html: string, r: WebAuditResult): void {
  const lower = html.toLowerCase();
  const widgets: Record<string, string> = {
    "intercom.io": "Intercom",
    "drift.com": "Drift",
    "embed.tawk.to": "Tawk.to",
    "crisp.chat": "Crisp",
    "livechatinc.com": "LiveChat",
    "snippet.zopim.com": "Zendesk Chat",
    "zd-chat": "Zendesk Chat",
    "hubspot.com/conversations": "HubSpot Chat",
    "tidio.com": "Tidio",
  };
  for (const [needle, name] of Object.entries(widgets)) {
    if (lower.includes(needle)) {
      r.has_chat_widget = true;
      r.chat_widget = name;
      return;
    }
  }
  if (/wa\.me\/\d+/i.test(html) || /api\.whatsapp\.com\/send/i.test(html)) {
    r.has_chat_widget = true;
    r.chat_widget = "WhatsApp flotante";
  }
}

function parseContactInfo(html: string, r: WebAuditResult): void {
  r.has_forms = /<form[\s>]/i.test(html);

  const phones = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([+\d\s\-()]+)["']/gi)) {
    phones.add(m[1].trim());
  }
  r.phones = Array.from(phones).slice(0, 5);
  r.has_phone = r.phones.length > 0;

  const emails = new Set<string>();
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)["']/gi)) {
    emails.add(m[1].trim().toLowerCase());
  }
  for (const m of html.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    if (emails.size >= 5) break;
    const e = m[0].toLowerCase();
    // Filtra "@2x.png" y similares
    if (!/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i.test(e)) emails.add(e);
  }
  r.emails = Array.from(emails).slice(0, 5);
  r.has_email = r.emails.length > 0;

  const wa = new Set<string>();
  for (const m of html.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d+)/gi)) {
    wa.add(m[1]);
  }
  r.whatsapp_links = Array.from(wa).slice(0, 3);
  r.has_whatsapp = r.whatsapp_links.length > 0;
}

function parseSocialLinks(html: string, r: WebAuditResult): void {
  const pick = (regex: RegExp): string | null => {
    const m = html.match(regex);
    return m ? m[0] : null;
  };
  r.social_links.instagram = pick(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i);
  r.social_links.facebook = pick(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/i);
  r.social_links.tiktok = pick(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/i);
  r.social_links.youtube = pick(/https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[A-Za-z0-9._-]+/i);
  r.social_links.linkedin = pick(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._-]+/i);
  r.social_links.twitter = pick(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i);
}

function detectEcommerce(html: string, r: WebAuditResult): void {
  const lower = html.toLowerCase();
  r.has_ecommerce =
    lower.includes("add-to-cart") ||
    lower.includes("addtocart") ||
    lower.includes("cdn.shopify.com") ||
    lower.includes("woocommerce") ||
    lower.includes("magento") ||
    lower.includes("tiendanube") ||
    /\/checkout\b/.test(lower) ||
    /\/carrito\b/.test(lower) ||
    /\/cart\b/.test(lower);
}

async function fetchPageSpeed(
  url: string,
  apiKey: string
): Promise<{ performance: number | null; seo: number | null; accessibility: number | null; best_practices: number | null } | null> {
  const endpoint =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
    `&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&key=${apiKey}`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { lighthouseResult?: { categories?: Record<string, { score?: number }> } };
  const cat = data?.lighthouseResult?.categories ?? {};
  const pct = (k: string): number | null => {
    const s = cat[k]?.score;
    return typeof s === "number" ? Math.round(s * 100) : null;
  };
  return {
    performance: pct("performance"),
    seo: pct("seo"),
    accessibility: pct("accessibility"),
    best_practices: pct("best-practices"),
  };
}
