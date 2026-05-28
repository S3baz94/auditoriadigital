export type AuditSection =
  | "business"
  | "website"
  | "social"
  | "funnel"
  | "tracking"
  | "sales"
  | "ops"
  | "financials";

export interface AuditAnswersMap {
  business?: {
    target_customer?: string;
    offer?: string;
    primary_goal?: "leads" | "sales" | "both";
    monthly_revenue?: number;
  };
  website?: {
    has_website?: boolean;
    tech_stack?: string;
    has_clear_cta?: boolean;
    has_speed_issues?: boolean;
    has_booking_or_checkout?: boolean;
  };
  social?: {
    primary_channel?: string;
    posting_frequency_per_week?: number;
    uses_paid_ads?: boolean;
    has_content_pillars?: boolean;
    has_social_proof?: boolean;
  };
  funnel?: {
    has_lead_magnet?: boolean;
    has_landing_pages?: boolean;
    has_email_nurture?: boolean;
    uses_crm?: boolean;
    avg_response_time_minutes?: number;
  };
  tracking?: {
    has_ga4?: boolean;
    has_gtm?: boolean;
    has_meta_pixel?: boolean;
    has_capi?: boolean;
    has_conversions_defined?: boolean;
    uses_call_tracking?: boolean;
  };
  sales?: {
    sales_process?: "inbound_only" | "outbound" | "hybrid";
    has_script?: boolean;
    followup_system?: "none" | "manual" | "automated";
    closes_in_days?: number;
  };
  ops?: {
    biggest_bottleneck?: string;
    repeats_tasks?: boolean;
    uses_automation?: boolean;
    could_build_app?: boolean;
  };
  financials?: {
    currency?: string;
    avg_order_value?: number; // AOV
    gross_margin_pct?: number; // 0-100
    monthly_ad_spend?: number;
    website_visits_per_month?: number;
    lead_conversion_rate_pct?: number; // visit->lead
    close_rate_pct?: number; // lead->customer
    sales_cycle_days?: number;
  };
}

export interface AuditScoreBreakdown {
  website: number;
  social: number;
  funnel: number;
  tracking: number;
  sales: number;
  ops: number;
  financial_readiness: number;
}

export interface AuditFinancials {
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
}

export interface AuditRecommendation {
  id: string;
  title: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  category:
    | "website"
    | "social"
    | "tracking"
    | "funnel"
    | "sales"
    | "ops"
    | "paid_media"
    | "analytics"
    | "automation";
  why: string;
  what_to_do: string[];
  expected_result: string;
}

export interface AuditReport {
  overall_score: number; // 0-100
  scores: AuditScoreBreakdown;
  financials: AuditFinancials;
  recommendations: AuditRecommendation[];
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function scoreFromBooleans(items: Array<boolean | null | undefined>): number {
  if (!items.length) return 0;
  const valid = items.filter((x) => x !== null && x !== undefined) as boolean[];
  if (!valid.length) return 0;
  const yes = valid.filter(Boolean).length;
  return Math.round((yes / valid.length) * 100);
}

function safeNum(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  if (typeof n === "string" && n.trim() === "") return null;
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return v;
}

export function buildAuditReport(answers: AuditAnswersMap): AuditReport {
  const websiteScore = scoreFromBooleans([
    answers.website?.has_website,
    answers.website?.has_clear_cta,
    answers.website?.has_booking_or_checkout,
    answers.website?.has_speed_issues === undefined ? undefined : !answers.website?.has_speed_issues,
  ]);

  const socialScore = (() => {
    const freq = safeNum(answers.social?.posting_frequency_per_week);
    const freqScore = freq === null ? null : Math.round(clamp01(freq / 5) * 100);
    const pillars = answers.social?.has_content_pillars;
    const proof = answers.social?.has_social_proof;
    const paid = answers.social?.uses_paid_ads;
    const b = scoreFromBooleans([pillars, proof, paid]);
    if (freqScore === null) return b;
    return Math.round((b * 0.65 + freqScore * 0.35) / 1);
  })();

  const funnelScore = (() => {
    const base = scoreFromBooleans([
      answers.funnel?.has_lead_magnet,
      answers.funnel?.has_landing_pages,
      answers.funnel?.has_email_nurture,
      answers.funnel?.uses_crm,
    ]);
    const rt = safeNum(answers.funnel?.avg_response_time_minutes);
    // 5 min => 100, 60 min => 50, 240 min => 0
    const rtScore =
      rt === null ? null : Math.round(clamp01(1 - (rt - 5) / (240 - 5)) * 100);
    if (rtScore === null) return base;
    return Math.round(base * 0.7 + rtScore * 0.3);
  })();

  const trackingScore = scoreFromBooleans([
    answers.tracking?.has_ga4,
    answers.tracking?.has_gtm,
    answers.tracking?.has_meta_pixel,
    answers.tracking?.has_capi,
    answers.tracking?.has_conversions_defined,
    answers.tracking?.uses_call_tracking,
  ]);

  const salesScore = scoreFromBooleans([
    answers.sales?.has_script,
    answers.sales?.followup_system ? answers.sales.followup_system !== "none" : undefined,
    answers.sales?.sales_process ? answers.sales.sales_process !== "inbound_only" : undefined,
  ]);

  const opsScore = scoreFromBooleans([
    answers.ops?.repeats_tasks,
    answers.ops?.uses_automation,
    answers.ops?.could_build_app,
  ]);

  const fin = computeFinancials(answers);
  const financialReadiness = scoreFromBooleans([
    fin.monthly_ad_spend !== null,
    fin.website_visits_per_month !== null,
    fin.lead_conversion_rate_pct !== null,
    fin.close_rate_pct !== null,
    fin.aov !== null,
    fin.gross_margin_pct !== null,
  ]);

  const scores: AuditScoreBreakdown = {
    website: websiteScore,
    social: socialScore,
    funnel: funnelScore,
    tracking: trackingScore,
    sales: salesScore,
    ops: opsScore,
    financial_readiness: financialReadiness,
  };

  const overall_score = Math.round(
    (websiteScore * 0.18 +
      socialScore * 0.12 +
      funnelScore * 0.22 +
      trackingScore * 0.18 +
      salesScore * 0.16 +
      opsScore * 0.08 +
      financialReadiness * 0.06) /
      1
  );

  const recommendations = buildRecommendations(answers, scores, fin);

  return {
    overall_score,
    scores,
    financials: fin,
    recommendations,
  };
}

export function computeFinancials(answers: AuditAnswersMap): AuditFinancials {
  const currency = answers.financials?.currency || "USD";
  const aov = safeNum(answers.financials?.avg_order_value);
  const gm = safeNum(answers.financials?.gross_margin_pct);
  const ad = safeNum(answers.financials?.monthly_ad_spend);
  const visits = safeNum(answers.financials?.website_visits_per_month);
  const v2l = safeNum(answers.financials?.lead_conversion_rate_pct);
  const l2c = safeNum(answers.financials?.close_rate_pct);

  const leads =
    visits !== null && v2l !== null ? Math.round((visits * v2l) / 100) : null;
  const customers =
    leads !== null && l2c !== null ? Math.round((leads * l2c) / 100) : null;

  const revenue = customers !== null && aov !== null ? customers * aov : null;
  const gross_profit =
    revenue !== null && gm !== null ? revenue * (gm / 100) : null;

  const cpl = ad !== null && leads !== null && leads > 0 ? ad / leads : null;
  const cac = ad !== null && customers !== null && customers > 0 ? ad / customers : null;
  const roas = ad !== null && revenue !== null && ad > 0 ? revenue / ad : null;

  return {
    currency: typeof currency === "string" ? currency : "USD",
    aov,
    gross_margin_pct: gm,
    monthly_ad_spend: ad,
    website_visits_per_month: visits,
    lead_conversion_rate_pct: v2l,
    close_rate_pct: l2c,
    leads_per_month: leads,
    customers_per_month: customers,
    revenue_per_month: revenue,
    gross_profit_per_month: gross_profit,
    cpl,
    cac,
    roas,
  };
}

function buildRecommendations(
  answers: AuditAnswersMap,
  scores: AuditScoreBreakdown,
  fin: AuditFinancials
): AuditRecommendation[] {
  const recs: AuditRecommendation[] = [];

  if (scores.tracking < 70) {
    recs.push({
      id: "tracking-foundation",
      title: "Implementar medición completa (GA4 + GTM + Pixel + conversiones)",
      impact: "high",
      effort: "medium",
      category: "tracking",
      why: "Sin eventos y conversiones bien definidos, optimizar campañas y mejorar el embudo se vuelve guesswork.",
      what_to_do: [
        "Definir 3–5 conversiones críticas (lead, llamada, WhatsApp, compra, reserva).",
        "Instalar GA4 y GTM y validar eventos con DebugView.",
        "Configurar Pixel (y CAPI si hay formularios/checkout) + deduplicación.",
        "Crear un dashboard semanal (tráfico, leads, CPL, tasa de cierre).",
      ],
      expected_result: "Decisiones basadas en datos y mejora rápida de CPL/CAC.",
    });
  }

  if (scores.funnel < 70) {
    recs.push({
      id: "funnel-lead-system",
      title: "Construir un sistema de captación (landing + lead magnet + nurture)",
      impact: "high",
      effort: "medium",
      category: "funnel",
      why: "Un embudo consistente aumenta la tasa de conversión sin depender de “más tráfico”.",
      what_to_do: [
        "Crear 1 landing por oferta/servicio con CTA único.",
        "Añadir un lead magnet (checklist, guía, demo, diagnóstico).",
        "Configurar 5–7 emails de nurturing y reactivación.",
        "Integrar formularios con CRM y alertas al equipo de ventas.",
      ],
      expected_result: "Más leads por el mismo tráfico y mejor tasa de cierre.",
    });
  }

  if (scores.website < 70) {
    recs.push({
      id: "website-cro",
      title: "Mejorar el sitio para conversión (CRO + velocidad + confianza)",
      impact: "high",
      effort: "medium",
      category: "website",
      why: "El sitio suele ser el cuello de botella principal en captación: claridad + confianza + velocidad.",
      what_to_do: [
        "Reescribir el hero con propuesta de valor + prueba social + CTA.",
        "Añadir FAQs, casos, testimonios y garantías (según industria).",
        "Optimizar velocidad móvil (imágenes, lazy-load, fuentes).",
        "Agregar tracking a CTAs (botones, formularios, WhatsApp).",
      ],
      expected_result: "Subida de la tasa visit→lead y menor CPL.",
    });
  }

  if (scores.sales < 70) {
    recs.push({
      id: "sales-followup",
      title: "Estandarizar ventas: script + follow-up automatizado",
      impact: "high",
      effort: "low",
      category: "sales",
      why: "Gran parte de las ventas se pierden por tiempos de respuesta y seguimiento inconsistente.",
      what_to_do: [
        "Definir 1 guión de calificación (BANT/CHAMP) + objeciones frecuentes.",
        "Implementar follow-up automático por email/WhatsApp (D+0, D+1, D+3, D+7).",
        "SLA de respuesta (ideal < 15 min) con alertas internas.",
      ],
      expected_result: "Mejor tasa de contacto y aumento de cierres sin más leads.",
    });
  }

  if (scores.ops < 70 || answers.ops?.repeats_tasks) {
    recs.push({
      id: "ops-automation",
      title: "Automatizar procesos repetitivos (y evaluar una app interna ligera)",
      impact: "medium",
      effort: "medium",
      category: "automation",
      why: "Automatizar reduce costos operativos y acelera el ciclo lead→venta.",
      what_to_do: [
        "Mapear el flujo lead→venta (fuente, contacto, calificación, propuesta, cierre).",
        "Automatizar handoffs (formularios→CRM→asignación→notificación).",
        "Si hay alto volumen, construir una app simple: pipeline, SLA, plantillas y reporting.",
      ],
      expected_result: "Menos fugas, más velocidad operativa y mejor experiencia del cliente.",
    });
  }

  if (fin.monthly_ad_spend !== null && fin.roas !== null && fin.roas < 2) {
    recs.push({
      id: "paid-media-efficiency",
      title: "Optimizar pauta: estructura, creativos y medición para mejorar ROAS",
      impact: "high",
      effort: "medium",
      category: "paid_media",
      why: "Cuando el ROAS es bajo, normalmente falta medición o el mensaje/oferta no coincide con la intención.",
      what_to_do: [
        "Separar campañas por intención (fría vs remarketing) y por oferta.",
        "Probar 5–10 ángulos de creatividad y 3 hooks por oferta.",
        "Usar eventos correctos (lead calificado o compra) y excluir tráfico irrelevante.",
      ],
      expected_result: "Baja del CAC y posibilidad de escalar inversión.",
    });
  }

  // Always include a “next 14 days” action plan
  recs.push({
    id: "plan-14-days",
    title: "Plan de ejecución 14 días (quick wins)",
    impact: "high",
    effort: "low",
    category: "analytics",
    why: "Un plan corto evita parálisis y genera mejoras medibles rápido.",
    what_to_do: [
      "Día 1–2: definir conversiones y auditar tracking.",
      "Día 3–5: optimizar landing/hero/CTA + pruebas sociales.",
      "Día 6–10: lead magnet + nurture + CRM + SLA.",
      "Día 11–14: pruebas de anuncios y reporteo semanal.",
    ],
    expected_result: "Primer ciclo de mejoras con métricas (CPL, tasa de cierre, ROAS).",
  });

  return recs;
}

