import "./style.css";
import { api, toast } from "./api";

type View = "dashboard" | "prospect" | "leads" | "campaigns" | "smtp" | "audit" | "audit_report";

interface DashboardStats {
  total_leads: number;
  leads_with_email: number;
  valid_emails: number;
  scrape_jobs: number;
  campaigns: number;
  emails_sent: number;
}

interface Lead {
  id: string;
  username: string;
  full_name: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  followers_count: number;
  email_status: string;
  job_id: string | null;
}

const app = document.getElementById("app")!;
let currentView: View = "dashboard";
let selectedAuditId: string | null = null;
let auditCurrentSection = "website";
let auditAnswersCache: Record<string, Record<string, unknown>> = {};
let leadsQuery = { q: "", email_status: "" };

// ── Shell & nav ───────────────────────────────────────────────────────────

function shell(content: string): void {
  app.innerHTML = `
    <div class="layout">
      <button class="hamburger" id="hamburger" aria-label="Menú">☰</button>
      <aside class="sidebar" id="sidebar">
        <div class="logo">Lead<span>Pulse</span></div>
        <p class="tagline">Prospección → verificación → outreach</p>
        <nav class="nav">
          ${navBtn("dashboard", "Panel")}
          ${navBtn("prospect", "Extraer leads")}
          ${navBtn("leads", "Lista de leads")}
          ${navBtn("audit", "Auditoría digital")}
          ${navBtn("smtp", "Cuentas SMTP")}
          ${navBtn("campaigns", "Campañas")}
        </nav>
      </aside>
      <main>${content}</main>
    </div>
  `;
  document.querySelectorAll(".nav button").forEach((b) => {
    b.addEventListener("click", () => {
      currentView = (b as HTMLButtonElement).dataset.view as View;
      document.getElementById("sidebar")?.classList.remove("open");
      render();
    });
  });
  document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
  });
}

function navBtn(view: View, label: string): string {
  const active =
    currentView === view || (currentView === "audit_report" && view === "audit")
      ? "active"
      : "";
  return `<button type="button" class="${active}" data-view="${view}">${label}</button>`;
}

async function render(): Promise<void> {
  try {
    switch (currentView) {
      case "dashboard":       await renderDashboard(); break;
      case "prospect":        renderProspect();        break;
      case "leads":           await renderLeads();     break;
      case "audit":           await renderAudit();     break;
      case "audit_report":    await renderAuditReport(); break;
      case "smtp":            await renderSmtp();      break;
      case "campaigns":       await renderCampaigns(); break;
    }
  } catch (e) {
    shell(`<p style="color:var(--danger)">Error: ${e instanceof Error ? e.message : "unknown"}</p>`);
  }
}

// ── Audit types ───────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  status: string;
  business_name: string;
  industry: string | null;
  country: string | null;
  currency: string;
  website_url: string | null;
  instagram_url: string | null;
  created_at: string;
  overall_score?: number | null;
};

type AuditReportResponse = {
  audit: AuditRow;
  report: {
    overall_score: number;
    scores: {
      website: number;
      social: number;
      funnel: number;
      tracking: number;
      sales: number;
      ops: number;
      financial_readiness: number;
    };
    financials: {
      currency: string;
      aov: number | null;
      gross_margin_pct: number | null;
      monthly_ad_spend: number | null;
      website_visits_per_month: number | null;
      lead_conversion_rate_pct: number | null;
      close_rate_pct: number | null;
      leads_per_month: number | null;
      customers_per_month: number | null;
      revenue_per_month: number | null;
      gross_profit_per_month: number | null;
      cpl: number | null;
      cac: number | null;
      roas: number | null;
    };
    recommendations: Array<{
      id: string;
      title: string;
      impact: "high" | "medium" | "low";
      effort: "low" | "medium" | "high";
      category: string;
      why: string;
      what_to_do: string[];
      expected_result: string;
    }>;
  };
  answers: Record<string, Record<string, unknown>>;
};

// ── Audit questionnaire helpers ────────────────────────────────────────────

function boolCheck(name: string, label: string, val: unknown): string {
  const checked = val === true || val === "true" || val === 1 ? "checked" : "";
  return `<label class="check-row">
    <input type="checkbox" name="${name}" ${checked} />
    <span>${label}</span>
  </label>`;
}

const SECTION_LABELS: Record<string, string> = {
  business:  "Negocio",
  website:   "Sitio web",
  social:    "Social",
  funnel:    "Embudo",
  tracking:  "Analítica",
  sales:     "Ventas",
  ops:       "Operaciones",
};

const SECTION_BOOL_FIELDS: Record<string, string[]> = {
  business:  [],
  website:   ["has_website", "has_clear_cta", "has_booking_or_checkout", "has_speed_issues"],
  social:    ["uses_paid_ads", "has_content_pillars", "has_social_proof"],
  funnel:    ["has_lead_magnet", "has_landing_pages", "has_email_nurture", "uses_crm"],
  tracking:  ["has_ga4", "has_gtm", "has_meta_pixel", "has_capi", "has_conversions_defined", "uses_call_tracking"],
  sales:     ["has_script"],
  ops:       ["repeats_tasks", "uses_automation", "could_build_app"],
};

function sectionFormHtml(section: string, ans: Record<string, unknown>): string {
  const s = (k: string) => String(ans[k] ?? "");

  switch (section) {
    case "business":
      return `<form data-section="business" class="section-form">
        <div class="form-row">
          <label>¿Quién es tu cliente ideal?
            <input name="target_customer" value="${s("target_customer")}" placeholder="Ej: Dueños de clínicas dentales en México" />
          </label>
          <label>Oferta / servicio principal
            <input name="offer" value="${s("offer")}" placeholder="Ej: Consultoría de marketing + pauta Meta" />
          </label>
        </div>
        <div class="form-row">
          <label>Objetivo principal
            <select name="primary_goal">
              <option value="">— Seleccionar —</option>
              <option value="leads"  ${ans.primary_goal === "leads"  ? "selected" : ""}>Captación de leads</option>
              <option value="sales"  ${ans.primary_goal === "sales"  ? "selected" : ""}>Ventas directas</option>
              <option value="both"   ${ans.primary_goal === "both"   ? "selected" : ""}>Ambos</option>
            </select>
          </label>
          <label>Ingreso mensual actual (referencia)
            <input name="monthly_revenue" type="number" value="${s("monthly_revenue")}" placeholder="Ej: 15000" />
          </label>
        </div>
        <button class="btn secondary" type="submit">Guardar negocio</button>
      </form>`;

    case "website":
      return `<form data-section="website" class="section-form">
        <div class="check-group">
          ${boolCheck("has_website",             "Tienes sitio web activo", ans.has_website)}
          ${boolCheck("has_clear_cta",           "El sitio tiene un CTA claro (reserva, cotización, compra, WhatsApp)", ans.has_clear_cta)}
          ${boolCheck("has_booking_or_checkout", "Hay formulario, reserva o checkout funcional en el sitio", ans.has_booking_or_checkout)}
          ${boolCheck("has_speed_issues",        "El sitio tiene problemas de velocidad en móvil (PageSpeed < 70)", ans.has_speed_issues)}
        </div>
        <button class="btn secondary" type="submit">Guardar sitio web</button>
      </form>`;

    case "social":
      return `<form data-section="social" class="section-form">
        <div class="form-row">
          <label>Canal principal
            <select name="primary_channel">
              <option value="">— Seleccionar —</option>
              ${["Instagram","Facebook","TikTok","YouTube","LinkedIn","Pinterest","Twitter/X","Otro"].map(c =>
                `<option value="${c.toLowerCase()}" ${s("primary_channel").toLowerCase() === c.toLowerCase() ? "selected" : ""}>${c}</option>`
              ).join("")}
            </select>
          </label>
          <label>Publicaciones por semana (promedio)
            <input name="posting_frequency_per_week" type="number" min="0" max="100" value="${s("posting_frequency_per_week")}" placeholder="Ej: 4" />
          </label>
        </div>
        <div class="check-group">
          ${boolCheck("uses_paid_ads",        "Usas pauta pagada (Meta Ads, Google Ads, TikTok Ads…)", ans.uses_paid_ads)}
          ${boolCheck("has_content_pillars",  "Tienes pilares de contenido definidos y los sigues", ans.has_content_pillars)}
          ${boolCheck("has_social_proof",     "Publicas regularmente casos de éxito, reseñas o testimonios", ans.has_social_proof)}
        </div>
        <button class="btn secondary" type="submit">Guardar social</button>
      </form>`;

    case "funnel":
      return `<form data-section="funnel" class="section-form">
        <div class="check-group">
          ${boolCheck("has_lead_magnet",    "Tienes un lead magnet (guía, checklist, diagnóstico, demo gratis)", ans.has_lead_magnet)}
          ${boolCheck("has_landing_pages",  "Tienes landing pages específicas por oferta / producto", ans.has_landing_pages)}
          ${boolCheck("has_email_nurture",  "Tienes secuencias de email automáticas para nutrir leads", ans.has_email_nurture)}
          ${boolCheck("uses_crm",           "Usas un CRM para registrar y dar seguimiento a todos los leads", ans.uses_crm)}
        </div>
        <div class="form-row" style="margin-top:0.75rem">
          <label>Tiempo promedio de primera respuesta a un lead (minutos)
            <input name="avg_response_time_minutes" type="number" min="0" value="${s("avg_response_time_minutes")}" placeholder="Ej: 30" />
          </label>
        </div>
        <button class="btn secondary" type="submit">Guardar embudo</button>
      </form>`;

    case "tracking":
      return `<form data-section="tracking" class="section-form">
        <div class="check-group">
          ${boolCheck("has_ga4",                  "Google Analytics 4 instalado y con datos de los últimos 30 días", ans.has_ga4)}
          ${boolCheck("has_gtm",                  "Google Tag Manager configurado y gestionando los tags", ans.has_gtm)}
          ${boolCheck("has_meta_pixel",            "Meta Pixel activo y enviando eventos al sitio", ans.has_meta_pixel)}
          ${boolCheck("has_capi",                  "Conversions API (CAPI) configurada para deduplicar eventos", ans.has_capi)}
          ${boolCheck("has_conversions_defined",   "Conversiones definidas en plataforma de ads (lead, compra, llamada)", ans.has_conversions_defined)}
          ${boolCheck("uses_call_tracking",        "Usas tracking de llamadas (número dinámico, CallRail, etc.)", ans.uses_call_tracking)}
        </div>
        <button class="btn secondary" type="submit">Guardar analítica</button>
      </form>`;

    case "sales":
      return `<form data-section="sales" class="section-form">
        <div class="form-row">
          <label>Proceso de ventas actual
            <select name="sales_process">
              <option value="">— Seleccionar —</option>
              <option value="inbound_only" ${ans.sales_process === "inbound_only" ? "selected" : ""}>Solo inbound — espero que me contacten</option>
              <option value="outbound"     ${ans.sales_process === "outbound"     ? "selected" : ""}>Solo outbound — yo contacto leads</option>
              <option value="hybrid"       ${ans.sales_process === "hybrid"       ? "selected" : ""}>Híbrido — inbound + outbound</option>
            </select>
          </label>
          <label>Sistema de seguimiento post-contacto
            <select name="followup_system">
              <option value="">— Seleccionar —</option>
              <option value="none"      ${ans.followup_system === "none"      ? "selected" : ""}>Sin seguimiento sistemático</option>
              <option value="manual"    ${ans.followup_system === "manual"    ? "selected" : ""}>Manual (agenda / recordatorios)</option>
              <option value="automated" ${ans.followup_system === "automated" ? "selected" : ""}>Automatizado (CRM / secuencias)</option>
            </select>
          </label>
          <label>Días promedio para cerrar una venta
            <input name="closes_in_days" type="number" min="0" value="${s("closes_in_days")}" placeholder="Ej: 14" />
          </label>
        </div>
        <div class="check-group">
          ${boolCheck("has_script", "Tienes guión de ventas y respuestas a las objeciones frecuentes documentadas", ans.has_script)}
        </div>
        <button class="btn secondary" type="submit">Guardar ventas</button>
      </form>`;

    case "ops":
      return `<form data-section="ops" class="section-form">
        <div class="check-group">
          ${boolCheck("repeats_tasks",    "Hay tareas manuales repetitivas que podrían automatizarse", ans.repeats_tasks)}
          ${boolCheck("uses_automation",  "Ya usas herramientas de automatización (Make, Zapier, n8n…)", ans.uses_automation)}
          ${boolCheck("could_build_app",  "Una app interna simple mejoraría significativamente tu operación", ans.could_build_app)}
        </div>
        <div class="form-row" style="margin-top:0.75rem">
          <label style="flex:2">Principal cuello de botella operativo
            <textarea name="biggest_bottleneck" placeholder="Ej: El proceso de cotización tarda demasiado y perdemos leads…">${s("biggest_bottleneck")}</textarea>
          </label>
        </div>
        <button class="btn secondary" type="submit">Guardar operaciones</button>
      </form>`;

    default:
      return "<p>Sección no encontrada.</p>";
  }
}

function attachSectionListener(auditId: string, section: string): void {
  const form = document.querySelector<HTMLFormElement>(`.section-form[data-section="${section}"]`);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const answers: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) answers[k] = v;
    for (const f of SECTION_BOOL_FIELDS[section] ?? []) answers[f] = fd.get(f) === "on";
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement && el.type === "number" && el.name && el.value !== "")
        answers[el.name] = Number(el.value);
    }
    await api(`/api/audits/${auditId}/answers`, {
      method: "PUT",
      body: JSON.stringify({ section, answers }),
    });
    auditAnswersCache[section] = answers;
    toast("Guardado — recalculando scores…");
    await renderAuditReport();
  });
}

// ── Audit list ────────────────────────────────────────────────────────────

async function renderAudit(): Promise<void> {
  const { audits } = await api<{ audits: AuditRow[] }>("/api/audits");

  const rows = audits
    .map((a) => {
      const score = a.overall_score ?? null;
      const badge =
        score === null
          ? `<span class="badge unknown">—</span>`
          : score >= 80
            ? `<span class="badge valid">${score}</span>`
            : score >= 60
              ? `<span class="badge risky">${score}</span>`
              : `<span class="badge invalid">${score}</span>`;
      const web = a.website_url
        ? `<a href="${a.website_url}" target="_blank" rel="noreferrer">${a.website_url}</a>`
        : "—";
      return `<tr>
        <td><strong>${a.business_name}</strong>
          <div style="color:var(--muted);font-size:0.8rem">${a.industry || "—"}</div>
        </td>
        <td>${a.country || "—"}</td>
        <td>${badge}</td>
        <td>${web}</td>
        <td><button class="btn secondary btn-open-audit" data-id="${a.id}">Abrir</button></td>
      </tr>`;
    })
    .join("");

  shell(`
    <h1>Auditoría digital</h1>
    <p class="sub">Cuestionario guiado + scoring + modelo financiero + recomendaciones para mejorar captación y ventas.</p>

    <div class="panel">
      <h2>Nueva auditoría</h2>
      <form id="audit-create">
        <div class="form-row">
          <label>Nombre del negocio
            <input name="business_name" placeholder="Ej: Clínica Dental Sonrisa" required />
          </label>
          <label>Industria
            <input name="industry" placeholder="Ej: Salud, E-commerce, Servicios" />
          </label>
          <label>País
            <input name="country" placeholder="Ej: México" />
          </label>
          <label>Moneda
            <select name="currency">
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
              <option value="COP">COP</option>
              <option value="ARS">ARS</option>
              <option value="CLP">CLP</option>
              <option value="PEN">PEN</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>Sitio web <input name="website_url" placeholder="https://tusitio.com" /></label>
          <label>Instagram <input name="instagram_url" placeholder="https://instagram.com/tu_cuenta" /></label>
          <label>Google Business <input name="google_business_url" placeholder="https://g.page/…" /></label>
        </div>
        <label>Notas
          <textarea name="notes" placeholder="Objetivo, contexto, problemas actuales…"></textarea>
        </label>
        <button class="btn" type="submit">Crear auditoría</button>
      </form>
    </div>

    <div class="panel" style="overflow-x:auto">
      <h2>Auditorías recientes</h2>
      <table>
        <thead>
          <tr><th>Negocio</th><th>País</th><th>Score</th><th>Web</th><th></th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='5'>Aún no hay auditorías.</td></tr>"}</tbody>
      </table>
    </div>
  `);

  document.getElementById("audit-create")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = Object.fromEntries(fd.entries());
    const r = await api<{ id: string }>("/api/audits", {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast("Auditoría creada. Completa el cuestionario.");
    selectedAuditId = r.id;
    auditCurrentSection = "website";
    auditAnswersCache = {};
    currentView = "audit_report";
    render();
  });

  document.querySelectorAll(".btn-open-audit").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedAuditId = (btn as HTMLButtonElement).dataset.id || null;
      auditCurrentSection = "website";
      auditAnswersCache = {};
      currentView = "audit_report";
      render();
    });
  });
}

// ── Audit report ──────────────────────────────────────────────────────────

function numInput(name: string, placeholder: string, value?: number | null): string {
  const v = value == null ? "" : String(value);
  return `<input name="${name}" type="number" placeholder="${placeholder}" value="${v}" />`;
}

function pctInput(name: string, placeholder: string, value?: number | null): string {
  const v = value == null ? "" : String(value);
  return `<input name="${name}" type="number" step="0.1" min="0" max="100" placeholder="${placeholder}" value="${v}" />`;
}

async function renderAuditReport(): Promise<void> {
  if (!selectedAuditId) {
    currentView = "audit";
    return render();
  }

  shell(`<h1>Auditoría</h1><p class="sub">Cargando reporte…</p>`);

  const res = await api<AuditReportResponse>(`/api/audits/${selectedAuditId}/report`);
  const a = res.audit;
  const r = res.report;
  auditAnswersCache = res.answers ?? {};

  const score = r.overall_score;
  const scoreBadge =
    score >= 80
      ? `<span class="badge valid">${score}</span>`
      : score >= 60
        ? `<span class="badge risky">${score}</span>`
        : `<span class="badge invalid">${score}</span>`;

  const scoreLabels: Record<string, string> = {
    website: "Sitio web", social: "Social", funnel: "Embudo",
    tracking: "Analítica", sales: "Ventas", ops: "Ops", financial_readiness: "Financiero",
  };
  const scoreCards = Object.entries(r.scores)
    .map(([k, v]) => {
      const color = v >= 70 ? "var(--success)" : v >= 40 ? "var(--warn)" : "var(--danger)";
      return `<div class="card">
        <div class="label">${scoreLabels[k] ?? k}</div>
        <div class="value" style="color:${color}">${v}</div>
      </div>`;
    })
    .join("");

  const tabBtns = Object.entries(SECTION_LABELS)
    .map(([k, label]) =>
      `<button type="button" class="audit-tab${k === auditCurrentSection ? " active" : ""}" data-section="${k}">${label}</button>`
    )
    .join("");

  const fin = r.financials;
  const money = (n: number | null) =>
    n === null ? "—" : `${fin.currency} ${Math.round(n).toLocaleString()}`;

  const recHtml = r.recommendations
    .map(
      (rec) => `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start">
          <div>
            <h2 style="margin-bottom:0.35rem">${rec.title}</h2>
            <div style="color:var(--muted);font-size:0.85rem">${rec.why}</div>
          </div>
          <div style="text-align:right;color:var(--muted);font-size:0.8rem;white-space:nowrap">
            Impacto: <strong style="color:var(--text)">${rec.impact}</strong><br/>
            Esfuerzo: <strong style="color:var(--text)">${rec.effort}</strong>
          </div>
        </div>
        <ul style="margin-top:0.9rem;line-height:1.55;color:var(--muted);padding-left:1.2rem">
          ${rec.what_to_do.map((x) => `<li>${x}</li>`).join("")}
        </ul>
        <div style="margin-top:0.75rem;color:var(--accent-2);font-size:0.85rem">
          Resultado esperado: ${rec.expected_result}
        </div>
      </div>`
    )
    .join("");

  shell(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <button class="btn ghost btn-sm" id="btn-back-audit">← Volver</button>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <span style="color:var(--muted);font-size:0.8rem">Score global</span>
        <span style="font-size:1.2rem">${scoreBadge}</span>
      </div>
    </div>

    <h1>${a.business_name}</h1>
    <p class="sub">${[a.industry, a.country].filter(Boolean).join(" · ") || "Auditoría digital"}</p>

    <div class="cards">${scoreCards}</div>

    <div class="panel">
      <h2>Cuestionario de diagnóstico</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem">
        Completa cada sección para obtener un score preciso y recomendaciones accionables.
      </p>
      <div class="audit-tabs">${tabBtns}</div>
      <div id="section-form-content" style="padding-top:1.25rem">
        ${sectionFormHtml(auditCurrentSection, auditAnswersCache[auditCurrentSection] ?? {})}
      </div>
    </div>

    <div class="panel">
      <h2>Datos financieros</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem">
        Completa lo que sepas. Cada guardado recalcula el modelo financiero.
      </p>
      <form id="audit-financials">
        <div class="form-row">
          <label>Visitas web / mes ${numInput("website_visits_per_month", "Ej: 10000", fin.website_visits_per_month)}</label>
          <label>Conv. visita→lead (%) ${pctInput("lead_conversion_rate_pct", "Ej: 2.5", fin.lead_conversion_rate_pct)}</label>
          <label>Cierre lead→cliente (%) ${pctInput("close_rate_pct", "Ej: 15", fin.close_rate_pct)}</label>
          <label>Ticket promedio (AOV) ${numInput("avg_order_value", "Ej: 120", fin.aov)}</label>
        </div>
        <div class="form-row">
          <label>Margen bruto (%) ${pctInput("gross_margin_pct", "Ej: 55", fin.gross_margin_pct)}</label>
          <label>Inversión ads / mes ${numInput("monthly_ad_spend", "Ej: 1500", fin.monthly_ad_spend)}</label>
          <label>Moneda
            <select name="currency">
              ${["USD","MXN","COP","ARS","CLP","PEN","EUR"]
                .map((c) => `<option value="${c}" ${c === fin.currency ? "selected" : ""}>${c}</option>`)
                .join("")}
            </select>
          </label>
          <div style="flex:1;min-width:140px"></div>
        </div>
        <button class="btn secondary" type="submit">Guardar y recalcular</button>
      </form>
    </div>

    <div class="panel">
      <h2>Modelo financiero estimado</h2>
      <div class="cards" style="margin-bottom:0">
        <div class="card"><div class="label">Leads / mes</div><div class="value">${fin.leads_per_month ?? "—"}</div></div>
        <div class="card"><div class="label">Clientes / mes</div><div class="value">${fin.customers_per_month ?? "—"}</div></div>
        <div class="card"><div class="label">Ingresos / mes</div><div class="value">${money(fin.revenue_per_month)}</div></div>
        <div class="card"><div class="label">CPL</div><div class="value">${money(fin.cpl)}</div></div>
        <div class="card"><div class="label">CAC</div><div class="value">${money(fin.cac)}</div></div>
        <div class="card"><div class="label">ROAS</div><div class="value">${fin.roas === null ? "—" : fin.roas.toFixed(2)}</div></div>
      </div>
      <div style="color:var(--muted);font-size:0.85rem;margin-top:0.75rem">
        Estimado basado en tus inputs. Al agregar tracking/CRM los datos se vuelven más precisos.
      </div>
    </div>

    <h1 style="margin-top:1.5rem">Recomendaciones</h1>
    <p class="sub">Priorizadas por impacto y esfuerzo para captación de leads, conversión y ventas.</p>
    ${recHtml}
  `);

  document.getElementById("btn-back-audit")!.addEventListener("click", () => {
    currentView = "audit";
    render();
  });

  // Tab switching — swaps HTML without re-fetching
  document.querySelectorAll(".audit-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      auditCurrentSection = (btn as HTMLButtonElement).dataset.section!;
      document.querySelectorAll(".audit-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const container = document.getElementById("section-form-content")!;
      container.innerHTML = sectionFormHtml(auditCurrentSection, auditAnswersCache[auditCurrentSection] ?? {});
      attachSectionListener(selectedAuditId!, auditCurrentSection);
    });
  });

  attachSectionListener(selectedAuditId!, auditCurrentSection);

  document.getElementById("audit-financials")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = Object.fromEntries(fd.entries());
    await api(`/api/audits/${selectedAuditId}/answers`, {
      method: "PUT",
      body: JSON.stringify({ section: "financials", answers: body }),
    });
    toast("Guardado. Recalculando…");
    await renderAuditReport();
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────

async function renderDashboard(): Promise<void> {
  const s = await api<DashboardStats>("/api/stats/dashboard");
  shell(`
    <h1>Panel</h1>
    <p class="sub">Flujo tipo MailerFind: extrae o importa leads, verifica emails, lanza campañas y exporta a Meta.</p>
    <div class="cards">
      <div class="card"><div class="label">Leads</div><div class="value">${s.total_leads}</div></div>
      <div class="card"><div class="label">Con email</div><div class="value">${s.leads_with_email}</div></div>
      <div class="card"><div class="label">Emails válidos</div><div class="value">${s.valid_emails}</div></div>
      <div class="card"><div class="label">Jobs</div><div class="value">${s.scrape_jobs}</div></div>
      <div class="card"><div class="label">Campañas</div><div class="value">${s.campaigns}</div></div>
      <div class="card"><div class="label">Enviados</div><div class="value">${s.emails_sent}</div></div>
    </div>
    <div class="notice">
      <strong>Modo demo:</strong> la extracción simula perfiles públicos para desarrollo.
      Importa CSV reales o conecta una API conforme a los términos de cada plataforma.
      Solo usa datos públicos y cumple CAN-SPAM / GDPR.
    </div>
  `);
}

// ── Prospect ──────────────────────────────────────────────────────────────

function renderProspect(): void {
  shell(`
    <h1>Extraer leads</h1>
    <p class="sub">Segmenta por seguidores, hashtag, comentarios, etc. (generador demo integrado).</p>
    <div class="panel">
      <h2>Nueva extracción</h2>
      <form id="scrape-form" class="form-row">
        <label>Tipo
          <select name="source_type">
            <option value="followers">Seguidores de cuenta</option>
            <option value="following">Siguiendo</option>
            <option value="likers">Likers de post</option>
            <option value="commenters">Comentarios</option>
            <option value="hashtag">Hashtag</option>
            <option value="location">Ubicación</option>
          </select>
        </label>
        <label>Cuenta / hashtag / URL
          <input name="source_value" placeholder="@marca_competidor" required />
        </label>
        <label>Límite
          <input name="limit" type="number" value="50" min="5" max="500" />
        </label>
        <button type="submit" class="btn">Escanear</button>
      </form>
    </div>
    <div class="panel">
      <h2>Importar CSV</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem">
        Columnas: username, full_name, email, phone, bio, location, followers_count
      </p>
      <input type="file" id="csv-file" accept=".csv" />
      <button type="button" class="btn secondary" id="import-csv" style="margin-left:0.5rem">Importar</button>
    </div>
    <div class="panel">
      <h2>Acciones masivas</h2>
      <button type="button" class="btn secondary" id="enrich-names">NameAI — inferir nombres</button>
      <button type="button" class="btn secondary" id="verify-all" style="margin-left:0.5rem">Verificar emails pendientes</button>
    </div>
  `);

  document.getElementById("scrape-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = {
      source_type: fd.get("source_type"),
      source_value: fd.get("source_value"),
      limit: Number(fd.get("limit")),
    };
    const r = await api<{ total: number; with_email: number; job_id: string }>("/api/leads/scrape", {
      method: "POST", body: JSON.stringify(body),
    });
    toast(`Listo: ${r.total} leads (${r.with_email} con email)`);
    currentView = "leads";
    render();
  });

  document.getElementById("import-csv")!.addEventListener("click", async () => {
    const input = document.getElementById("csv-file") as HTMLInputElement;
    if (!input.files?.[0]) return toast("Selecciona un CSV");
    const fd = new FormData();
    fd.append("file", input.files[0]);
    const res = await fetch("/api/leads/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(`Importados: ${data.imported}`);
    currentView = "leads";
    render();
  });

  document.getElementById("enrich-names")!.addEventListener("click", async () => {
    const r = await api<{ enriched: number }>("/api/leads/enrich-names", { method: "POST", body: "{}" });
    toast(`Nombres enriquecidos: ${r.enriched}`);
  });

  document.getElementById("verify-all")!.addEventListener("click", async () => {
    const r = await api<{ verified: number }>("/api/leads/verify", { method: "POST", body: "{}" });
    toast(`Verificados: ${r.verified}`);
  });
}

// ── Leads ─────────────────────────────────────────────────────────────────

async function renderLeads(): Promise<void> {
  const params = new URLSearchParams({ limit: "100" });
  if (leadsQuery.q)            params.set("q",            leadsQuery.q);
  if (leadsQuery.email_status) params.set("email_status", leadsQuery.email_status);

  const { leads, total } = await api<{ leads: Lead[]; total: number }>(`/api/leads?${params}`);

  const rows = leads
    .map(
      (l) => `
      <tr>
        <td>@${l.username}</td>
        <td>${l.first_name || l.full_name || "—"}</td>
        <td>${l.email || "—"}</td>
        <td><span class="badge ${l.email_status}">${l.email_status}</span></td>
        <td>${l.followers_count?.toLocaleString() || 0}</td>
        <td>${l.location || "—"}</td>
      </tr>`
    )
    .join("");

  shell(`
    <h1>Leads <span style="font-size:1rem;color:var(--muted);font-family:var(--font)">(${total})</span></h1>
    <p class="sub">Filtra, exporta CSV o audiencia Meta.</p>

    <div class="form-row" style="margin-bottom:1rem">
      <input id="leads-search" value="${leadsQuery.q}" placeholder="Buscar por usuario, nombre o email…" style="flex:2;min-width:180px" />
      <select id="leads-filter-status">
        <option value=""       ${leadsQuery.email_status === ""        ? "selected" : ""}>Todos los estados</option>
        <option value="valid"  ${leadsQuery.email_status === "valid"   ? "selected" : ""}>Válido</option>
        <option value="risky"  ${leadsQuery.email_status === "risky"   ? "selected" : ""}>Arriesgado</option>
        <option value="invalid"${leadsQuery.email_status === "invalid" ? "selected" : ""}>Inválido</option>
        <option value="unknown"${leadsQuery.email_status === "unknown" ? "selected" : ""}>Sin verificar</option>
      </select>
      <button class="btn secondary" id="leads-search-btn">Buscar</button>
    </div>

    <div class="form-row" style="margin-bottom:1rem">
      <a class="btn secondary" href="/api/leads/export.csv" download>Exportar CSV</a>
      <a class="btn secondary" href="/api/leads/export.csv?valid_only=true" download>Solo válidos</a>
      <a class="btn ghost"     href="/api/leads/export-meta.csv" download>Meta Audience CSV</a>
    </div>

    <div class="panel" style="overflow-x:auto">
      <table>
        <thead>
          <tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>Estado</th><th>Seguidores</th><th>Ubicación</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='6'>Sin leads — extrae o importa primero.</td></tr>"}</tbody>
      </table>
    </div>
  `);

  const doSearch = async () => {
    leadsQuery.q            = (document.getElementById("leads-search")         as HTMLInputElement).value;
    leadsQuery.email_status = (document.getElementById("leads-filter-status")  as HTMLSelectElement).value;
    await renderLeads();
  };

  document.getElementById("leads-search-btn")!.addEventListener("click", doSearch);
  document.getElementById("leads-search")!.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") doSearch();
  });
}

// ── SMTP ──────────────────────────────────────────────────────────────────

async function renderSmtp(): Promise<void> {
  const { accounts } = await api<{
    accounts: Array<{ id: string; label: string; from_email: string; host: string }>;
  }>("/api/campaigns/smtp");

  shell(`
    <h1>Cuentas SMTP</h1>
    <p class="sub">Gmail, Outlook, SendGrid o cualquier proveedor SMTP.</p>
    <div class="panel">
      <h2>Conectar cuenta</h2>
      <form id="smtp-form">
        <div class="form-row">
          <label>Etiqueta   <input name="label"  required placeholder="Gmail principal" /></label>
          <label>Host       <input name="host"   value="smtp.gmail.com" required /></label>
          <label>Puerto     <input name="port"   type="number" value="587" /></label>
        </div>
        <div class="form-row">
          <label>Usuario    <input name="user"   required /></label>
          <label>Contraseña / App password <input name="pass" type="password" required /></label>
        </div>
        <div class="form-row">
          <label>Nombre remitente <input name="from_name" /></label>
          <label>Email remitente  <input name="from_email" type="email" required /></label>
          <label>Límite diario    <input name="daily_limit" type="number" value="200" /></label>
        </div>
        <button type="submit" class="btn">Verificar y guardar</button>
      </form>
    </div>
    <div class="panel">
      <h2>Cuentas guardadas</h2>
      <ul style="list-style:none;color:var(--muted)">
        ${accounts.length
          ? accounts.map((a) => `<li>${a.label} — ${a.from_email} (${a.host})</li>`).join("")
          : "<li>Ninguna cuenta aún</li>"}
      </ul>
    </div>
  `);

  document.getElementById("smtp-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = Object.fromEntries(fd.entries());
    await api("/api/campaigns/smtp", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        port: Number(body.port),
        daily_limit: Number(body.daily_limit),
        secure: Number(body.port) === 465,
      }),
    });
    toast("SMTP conectado");
    render();
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────

async function renderCampaigns(): Promise<void> {
  const [{ campaigns }, { accounts }] = await Promise.all([
    api<{ campaigns: Array<{ id: string; name: string; status: string; subject: string }> }>("/api/campaigns"),
    api<{ accounts: Array<{ id: string; label: string }> }>("/api/campaigns/smtp"),
  ]);

  const smtpOpts = accounts
    .map((a) => `<option value="${a.id}">${a.label}</option>`)
    .join("");

  const list = campaigns
    .map(
      (c) => `
      <tr>
        <td>${c.name}</td>
        <td>${c.subject}</td>
        <td>${c.status}</td>
        <td>
          <button class="btn secondary btn-start" data-id="${c.id}" ${c.status === "sending" ? "disabled" : ""}>Enviar</button>
          <button class="btn ghost btn-stats" data-id="${c.id}">Stats</button>
        </td>
      </tr>`
    )
    .join("");

  shell(`
    <h1>Campañas de email</h1>
    <p class="sub">Variables: {{first_name}}, {{last_name}}, {{username}}, {{email}}</p>
    <div class="panel">
      <h2>Nueva campaña</h2>
      <form id="campaign-form">
        <div class="form-row">
          <label>Nombre <input name="name" required /></label>
          <label>Asunto <input name="subject" required value="Hola {{first_name}}, colaboración rápida" /></label>
          <label>SMTP   <select name="smtp_account_id" required>${smtpOpts || "<option value=''>—</option>"}</select></label>
        </div>
        <label style="width:100%;margin-bottom:1rem">Cuerpo HTML
          <textarea name="body_html"><p>Hola {{first_name}},</p><p>Vi tu perfil @{{username}} y me gustaría conectar.</p><p>¿Tienes 5 min esta semana?</p></textarea>
        </label>
        <div class="form-row">
          <label>Delay entre envíos (ms) <input name="send_delay_ms" type="number" value="45000" /></label>
          <label><input type="checkbox" name="valid_email_only" checked /> Solo emails válidos</label>
        </div>
        <button type="submit" class="btn">Crear y encolar leads</button>
      </form>
    </div>
    <div class="panel">
      <h2>Campañas</h2>
      <table>
        <thead><tr><th>Nombre</th><th>Asunto</th><th>Estado</th><th></th></tr></thead>
        <tbody>${list || "<tr><td colspan='4'>Sin campañas</td></tr>"}</tbody>
      </table>
    </div>
    <pre id="stats-out" class="panel hidden" style="font-size:0.8rem;overflow:auto"></pre>
  `);

  document.getElementById("campaign-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = {
      name:              fd.get("name"),
      subject:           fd.get("subject"),
      body_html:         fd.get("body_html"),
      smtp_account_id:   fd.get("smtp_account_id"),
      send_delay_ms:     Number(fd.get("send_delay_ms")),
      valid_email_only:  (fd.get("valid_email_only") as string) === "on",
    };
    const r = await api<{ id: string; leads_queued: number }>("/api/campaigns", {
      method: "POST", body: JSON.stringify(body),
    });
    toast(`Campaña creada — ${r.leads_queued} leads en cola`);
    render();
  });

  document.querySelectorAll(".btn-start").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = (btn as HTMLButtonElement).dataset.id!;
      await api(`/api/campaigns/${id}/start`, { method: "POST", body: "{}" });
      toast("Envío iniciado en segundo plano");
    });
  });

  document.querySelectorAll(".btn-stats").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = (btn as HTMLButtonElement).dataset.id!;
      const r = await api<{ campaign: unknown; stats: unknown }>(`/api/campaigns/${id}/stats`);
      const out = document.getElementById("stats-out")!;
      out.classList.remove("hidden");
      out.textContent = JSON.stringify(r, null, 2);
    });
  });
}

render();
