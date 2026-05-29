// Motor de reporte ejecutivo consolidado para PulseAudit.
// Combina el análisis técnico web automático (webAudit) con las 9 respuestas de 
// negocio amigables para generar: score general, clasificación por segmento,
// resumen estratégico en prosa, hallazgos, hoja de ruta priorizada de soluciones 
// y bonos prácticos por nicho.

import type { NicheCode, SizeCode } from "./niches.js";
import { findNiche, findSize } from "./niches.js";
import type { WebAuditResult } from "./webAudit.js";

export type Segment = "emprendimiento" | "pequeno" | "crecimiento" | "establecido";

export interface ScoreBreakdown {
  web_foundation: number;
  seo: number;
  tracking: number;
  conversion: number;
  social_presence: number;
  overall: number;
}

export interface Finding {
  area: "web" | "seo" | "tracking" | "conversion" | "social" | "negocio";
  severity: "good" | "warn" | "bad";
  title: string;
  detail: string;
}

export interface SolutionStep {
  id: string;
  title: string;
  impact: "alto" | "medio" | "bajo";
  effort: "bajo" | "medio" | "alto";
  category: string;
  why: string;
  steps: string[];
}

export interface Bonus {
  id: string;
  title: string;
  description: string;
  tools?: string[];
}

export interface ExecutiveReport {
  segment: Segment;
  segment_label: string;
  niche_label: string;
  size_label: string;
  scores: ScoreBreakdown;
  executive_summary: string;
  findings: Finding[];
  solution_system: SolutionStep[];
  bonuses: Bonus[];
}

export type SurveyAnswers = Record<string, string | string[]>;

const SEGMENT_LABELS: Record<Segment, string> = {
  emprendimiento: "Emprendimiento / Fase Inicial",
  pequeno: "Negocio pequeño",
  crecimiento: "Negocio en crecimiento",
  establecido: "Negocio establecido o grande",
};

export function buildReport(
  audit: WebAuditResult,
  answers: SurveyAnswers,
  niche: NicheCode,
  size: SizeCode
): ExecutiveReport {
  // 1. Puntuación de cimientos y pilares técnicos
  const scores = computeScores(audit);

  // 2. Segmentación dinámica (combina análisis técnico y datos estratégicos)
  const segment = decideSegment(scores.overall, size, answers);

  // 3. Hallazgos detallados (técnicos y de negocio)
  const findings = buildFindings(audit, answers);

  // 4. Hoja de ruta integrada de soluciones (el puente comercial-operativo)
  const solution_system = buildSolutionSystem(audit, answers, niche, segment);

  // 5. Recursos / Bonos de valor agregado por nicho
  const bonuses = buildBonuses(niche);

  // 6. Síntesis ejecutiva personalizada en prosa
  const niche_label = findNiche(niche)?.label ?? "Negocio";
  const size_label = findSize(size)?.label ?? "—";
  const executive_summary = composeSummary(audit, answers, segment, niche, size, scores);

  return {
    segment,
    segment_label: SEGMENT_LABELS[segment],
    niche_label,
    size_label,
    scores,
    executive_summary,
    findings,
    solution_system,
    bonuses,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Cálculo de Scores (5 Pilares Técnicos)
// ─────────────────────────────────────────────────────────────────────

function computeScores(a: WebAuditResult): ScoreBreakdown {
  const web_foundation = computeWebFoundation(a);
  const seo = computeSeo(a);
  const tracking = computeTracking(a);
  const conversion = computeConversion(a);
  const social_presence = computeSocial(a);

  // Ponderación balanceada del score global
  const overall = Math.round(
    web_foundation * 0.22 +
      seo * 0.20 +
      tracking * 0.22 +
      conversion * 0.22 +
      social_presence * 0.14
  );
  return { web_foundation, seo, tracking, conversion, social_presence, overall };
}

function computeWebFoundation(a: WebAuditResult): number {
  let s = 0;
  if (a.reachable) s += 25;
  if (a.https) s += 20;
  if (a.has_viewport_meta) s += 20;
  if (a.has_favicon) s += 10;
  if (a.cms) s += 10;
  if (a.response_time_ms !== null && a.response_time_ms < 3000) s += 15;
  return Math.min(100, s);
}

function computeSeo(a: WebAuditResult): number {
  let s = 0;
  if (a.title && a.title.length > 10) s += 20;
  if (a.meta_description && a.meta_description.length > 50) s += 20;
  if (a.canonical) s += 10;
  if (a.language) s += 10;
  if (a.has_schema_org) s += 20;
  if (a.og_title && a.og_description) s += 10;
  if (a.og_image) s += 10;
  return Math.min(100, s);
}

function computeTracking(a: WebAuditResult): number {
  let s = 0;
  if (a.has_google_analytics) s += 30;
  if (a.has_gtm) s += 15;
  if (a.has_meta_pixel) s += 25;
  if (a.has_tiktok_pixel) s += 10;
  if (a.has_hotjar || a.has_clarity) s += 10;
  if (a.has_linkedin_insight) s += 10;
  return Math.min(100, s);
}

function computeConversion(a: WebAuditResult): number {
  let s = 0;
  if (a.has_forms) s += 25;
  if (a.has_phone) s += 15;
  if (a.has_email) s += 10;
  if (a.has_whatsapp) s += 20;
  if (a.has_chat_widget) s += 15;
  if (a.has_ecommerce) s += 15;
  return Math.min(100, s);
}

function computeSocial(a: WebAuditResult): number {
  const links = a.social_links;
  let count = 0;
  if (links.instagram) count++;
  if (links.facebook) count++;
  if (links.tiktok) count++;
  if (links.youtube) count++;
  if (links.linkedin) count++;
  if (links.twitter) count++;
  return Math.min(100, count * 25);
}

// ─────────────────────────────────────────────────────────────────────
// Motor de Segmentación Inteligente
// ─────────────────────────────────────────────────────────────────────

function decideSegment(
  overall: number,
  size: SizeCode,
  answers: SurveyAnswers
): Segment {
  // 1. Piso mínimo según tamaño de organización declarado
  const declaredFloor: Record<SizeCode, Segment> = {
    solo: "emprendimiento",
    micro: "emprendimiento",
    pequena: "pequeno",
    mediana: "crecimiento",
  };

  // 2. Clasificación técnica base según el análisis web automático
  let seg: Segment;
  if (overall < 30) seg = "emprendimiento";
  else if (overall < 55) seg = "pequeno";
  else if (overall < 80) seg = "crecimiento";
  else seg = "establecido";

  // Eleva el segmento al piso declarado si corresponde
  const floor = declaredFloor[size];
  const order: Segment[] = ["emprendimiento", "pequeno", "crecimiento", "establecido"];
  if (order.indexOf(seg) < order.indexOf(floor)) {
    seg = floor;
  }

  // 3. Ajuste por salud comercial y satisfacción tecnológica
  const stability = (answers.revenue_stability as string) ?? "";
  const satisfaction = (answers.tech_satisfaction as string) ?? "";

  // Si los ingresos crecen de forma constante y la tecnología ya está dominada, sube un nivel de segmento
  if (
    (stability === "growing" || satisfaction === "very_satisfied") &&
    order.indexOf(seg) < order.length - 1
  ) {
    seg = order[order.indexOf(seg) + 1];
  }

  return seg;
}

// ─────────────────────────────────────────────────────────────────────
// Generación de Hallazgos (Findings)
// ─────────────────────────────────────────────────────────────────────

function buildFindings(a: WebAuditResult, answers: SurveyAnswers): Finding[] {
  const f: Finding[] = [];

  // 1. Cimientos Técnicos
  if (!a.reachable) {
    f.push({ area: "web", severity: "bad", title: "Sitio web no responde", detail: `El servidor arrojó: ${a.errors[0] || "Timeout"}` });
  } else {
    f.push({ area: "web", severity: "good", title: "Accesibilidad óptima", detail: `Sitio web responde velozmente (${a.response_time_ms ?? "—"}ms)` });
    if (!a.https) {
      f.push({ area: "web", severity: "bad", title: "Conexión insegura (Falta SSL/HTTPS)", detail: "Reduce de inmediato el posicionamiento en Google e inspira desconfianza." });
    } else {
      f.push({ area: "web", severity: "good", title: "Conexión segura (HTTPS activo)", detail: "" });
    }
    if (!a.has_viewport_meta) {
      f.push({ area: "web", severity: "bad", title: "Incompatibilidad móvil", detail: "Falta viewport meta. El sitio no se adapta a celulares de forma responsiva." });
    }
  }

  // 2. SEO
  if (a.reachable) {
    if (!a.title) {
      f.push({ area: "seo", severity: "bad", title: "Falta etiqueta <title>", detail: "Google no sabe de qué trata el sitio. Pérdida absoluta de ranking." });
    } else if (a.title.length < 25 || a.title.length > 65) {
      f.push({ area: "seo", severity: "warn", title: "Título de longitud no óptima", detail: `Tiene ${a.title.length} letras. Lo ideal es entre 30 y 60 caracteres.` });
    } else {
      f.push({ area: "seo", severity: "good", title: "Título SEO óptimo", detail: a.title });
    }

    if (!a.meta_description) {
      f.push({ area: "seo", severity: "bad", title: "Sin meta descripción", detail: "Google autogenera el texto, reduciendo el interés de potenciales visitas." });
    }

    if (!a.has_schema_org) {
      f.push({ area: "seo", severity: "warn", title: "Sin marcado Schema.org", detail: "Sin datos estructurados para destacar en mapas locales o buscadores." });
    } else {
      f.push({ area: "seo", severity: "good", title: "Datos estructurados detectados", detail: a.schema_types.join(", ") });
    }
  }

  // 3. Medición y Pixel
  if (a.reachable) {
    if (!a.has_google_analytics) {
      f.push({ area: "tracking", severity: "bad", title: "Sin Google Analytics (GA4)", detail: "Estás operando a ciegas. Imposible medir de dónde vienen tus clientes en la web." });
    } else {
      f.push({ area: "tracking", severity: "good", title: "Google Analytics 4 activo", detail: "" });
    }

    if (!a.has_meta_pixel) {
      f.push({ area: "tracking", severity: "warn", title: "Sin Pixel de Meta (Facebook/IG Ads)", detail: "Campañas de pauta digital limitadas al no tener re-marketing ni optimización por conversiones." });
    }
  }

  // 4. Conversión y CRO
  if (a.reachable) {
    if (!a.has_forms && !a.has_whatsapp && !a.has_phone) {
      f.push({ area: "conversion", severity: "bad", title: "Sitio web meramente informativo", detail: "No hay formularios, botones de WhatsApp ni llamados de acción evidentes." });
    } else {
      if (a.has_whatsapp) f.push({ area: "conversion", severity: "good", title: "Canal directo: WhatsApp configurado", detail: "" });
      if (a.has_forms) f.push({ area: "conversion", severity: "good", title: "Formulario de contacto detectado", detail: "" });
    }
  }

  // 5. Consistencia Social
  const links = a.social_links;
  const activeCount = Object.values(links).filter(Boolean).length;
  if (activeCount === 0) {
    f.push({ area: "social", severity: "warn", title: "Sin redes enlazadas en el sitio", detail: "Los usuarios no pueden navegar del sitio a tus comunidades." });
  } else {
    f.push({ area: "social", severity: "good", title: `${activeCount} red(es) social(es) vinculada(s)`, detail: "" });
  }

  // 6. Diagnóstico del Negocio (Estratégico)
  const speed = (answers.response_time as string) ?? "";
  if (speed === "day_or_two" || speed === "more_than_48") {
    f.push({ area: "negocio", severity: "bad", title: "Velocidad de respuesta lenta a prospectos", detail: `Tardas entre ${speed === "day_or_two" ? "24-48h" : "+48h"}. Los leads se enfrían de inmediato.` });
  }

  const followup = (answers.sales_followup as string) ?? "";
  if (followup === "none") {
    f.push({ area: "negocio", severity: "warn", title: "Sin seguimiento comercial estructurado", detail: "Las cotizaciones se envían y dependen de la iniciativa del cliente." });
  }

  const satisfaction = (answers.tech_satisfaction as string) ?? "";
  if (satisfaction === "unsatisfied") {
    f.push({ area: "negocio", severity: "bad", title: "Fricción tecnológica interna", detail: "Las herramientas actuales restan tiempo en lugar de sumar eficiencia al equipo." });
  }

  return f;
}

// ─────────────────────────────────────────────────────────────────────
// Hoja de Ruta Priorizada (El Puente Tecnológico y Operativo)
// ─────────────────────────────────────────────────────────────────────

function buildSolutionSystem(
  a: WebAuditResult,
  answers: SurveyAnswers,
  niche: NicheCode,
  segment: Segment
): SolutionStep[] {
  const steps: SolutionStep[] = [];

  // 1. Soluciones Técnicas Críticas (Cimientos)
  if (a.reachable && !a.https) {
    steps.push({
      id: "ssl-https",
      title: "Instalar y activar certificado SSL (HTTPS)",
      impact: "alto",
      effort: "bajo",
      category: "Cimientos Digitales",
      why: "El protocolo seguro es innegociable. Sin él, los buscadores marcan la web como 'Insegura', ahuyentando visitas e impidiendo pasarelas de pago.",
      steps: [
        "Solicitar el certificado SSL (gratuito con Let's Encrypt o Cloudflare).",
        "Configurar redirección forzada de HTTP a HTTPS.",
        "Asegurar que todas las imágenes y recursos carguen de forma segura.",
      ],
    });
  }

  if (a.reachable && !a.has_viewport_meta) {
    steps.push({
      id: "mobile-responsive",
      title: "Optimizar diseño responsivo para móviles",
      impact: "alto",
      effort: "medio",
      category: "Cimientos Digitales",
      why: "Más del 60% del tráfico busca tu negocio en pantallas móviles. Si tu web se ve cortada o pequeña, las visitas se van inmediatamente.",
      steps: [
        "Inyectar la etiqueta viewport meta en el HTML.",
        "Refactorizar estilos CSS con grids y media-queries responsivos.",
        "Validar la experiencia táctil en Chrome DevTools.",
      ],
    });
  }

  // 2. Soluciones de Medición y Medios Digitales
  if (a.reachable && !a.has_google_analytics) {
    steps.push({
      id: "ga4-tracking",
      title: "Integrar Google Analytics 4 (GA4) y conversiones",
      impact: "alto",
      effort: "bajo",
      category: "Estrategia Digital",
      why: "Sin medición real, es imposible saber qué canales de adquisición funcionan, perdiendo dinero en publicidad ciega.",
      steps: [
        "Crear el flujo de medición en la consola oficial de Google Analytics.",
        "Pegar la etiqueta de seguimiento global en la cabecera.",
        "Configurar conversiones clave: envío de formulario, clic a WhatsApp o agendamientos.",
      ],
    });
  }

  // 3. Conexión de Negocio - Tiempo de Respuesta (Speed to Lead)
  const response = (answers.response_time as string) ?? "";
  if (response === "day_or_two" || response === "more_than_48") {
    steps.push({
      id: "automation-autoresponder",
      title: "Implementar auto-respondedor inteligente y bot de WhatsApp",
      impact: "alto",
      effort: "bajo",
      category: "Ventas y Comercial",
      why: `Declaraste que tardas entre ${response === "day_or_two" ? "24 y 48 horas" : "más de 48 horas"} en responder. En digital, un lead atendido en los primeros 5 minutos tiene 10 veces más probabilidades de cerrar.`,
      steps: [
        "Configurar respuestas automáticas instantáneas en formularios web.",
        "Habilitar WhatsApp Business con mensajes automáticos de bienvenida y respuestas rápidas configuradas.",
        "Integrar un chatbot interactivo básico de bienvenida en el sitio.",
      ],
    });
  }

  // 4. Conexión de Negocio - Seguimiento Comercial (Sales Follow-up)
  const followup = (answers.sales_followup as string) ?? "";
  if (followup === "none" || followup === "manual") {
    steps.push({
      id: "crm-integration",
      title: "Estructurar y configurar un CRM de Ventas en la nube",
      impact: "alto",
      effort: "medio",
      category: "Ventas y Comercial",
      why: "La falta de un seguimiento sistematizado de cotizaciones hace que se pierdan ventas valiosas por simple olvido. Un CRM automatiza recordatorios.",
      steps: [
        "Implementar un CRM ágil (como HubSpot Free, Pipedrive o un tablero Notion CRM automatizado).",
        "Mapear tus etapas comerciales: Contacto Nuevo → Calificado → Cotización Enviada → En Seguimiento → Cierre.",
        "Crear automatizaciones básicas: cuando una propuesta cumpla 3 días enviada, mandar email automático de seguimiento.",
      ],
    });
  }

  // 5. Conexión de Negocio - Gestión Operativa y Tareas Manuales
  const ops = (answers.operations_coordination as string) ?? "";
  if (ops === "manual") {
    steps.push({
      id: "ops-dashboard",
      title: "Digitalizar operaciones: de Excel/Papel a un Portal Web / CRM",
      impact: "medio",
      effort: "medio",
      category: "Operaciones e Integración",
      why: "Llevar la coordinación en papel o Excel fragmentado genera errores operativos y consume horas valiosas. Una app administrativa web o automatizaciones básicas liberan tu tiempo.",
      steps: [
        "Automatizar traspasos de información: que cada cliente web nuevo se registre en una hoja centralizada automáticamente.",
        "Definir un portal de gestión interna sencillo donde tu equipo pueda ver prioridades, fechas de entrega y estatus.",
        "Configurar alertas en Slack o WhatsApp cada vez que ocurra un evento operativo crítico.",
      ],
    });
  }

  // 6. Conexión de Negocio - Ingresos Variables y Boca a boca
  const stability = (answers.revenue_stability as string) ?? "";
  const acquisition = (answers.acquisition_channel as string) ?? "";
  if (stability === "highly_variable" && acquisition === "referrals") {
    steps.push({
      id: "inbound-predictable",
      title: "Crear embudo de adquisición web predecible (Local SEO + Landing)",
      impact: "alto",
      effort: "medio",
      category: "Estrategia Digital",
      why: "Depender 100% de recomendaciones te expone a meses de vacas flacas. Necesitas una máquina en internet que atraiga prospectos calificados constantemente de forma predecible.",
      steps: [
        "Diseñar una Landing Page enfocada exclusivamente en tu servicio más rentable con propuesta de valor clara.",
        "Optimizar al 100% tu ficha de Google Business Profile (reseñas, fotos semanales) para aparecer cuando busquen tu servicio localmente.",
        "Lanzar campañas de pauta digital de bajo presupuesto (Meta/Google Ads) apuntando a esa landing específica.",
      ],
    });
  }

  // 7. Velocidad del Servidor (Lighthouse Performance)
  if (a.response_time_ms !== null && a.response_time_ms > 3000) {
    steps.push({
      id: "web-speed-cro",
      title: "Optimizar la velocidad de carga y CRO de la página",
      impact: "medio",
      effort: "medio",
      category: "Cimientos Digitales",
      why: `El servidor responde en ${a.response_time_ms}ms. Cada segundo extra de carga reduce la conversión del tráfico en un 7% y genera rebote.`,
      steps: [
        "Comprimir imágenes pesadas y convertirlas al formato moderno WebP.",
        "Diferir la carga de JavaScript secundario que bloquea el renderizado.",
        "Implementar un CDN gratuito como Cloudflare para cachear el contenido.",
      ],
    });
  }

  return steps;
}

// ─────────────────────────────────────────────────────────────────────
// Banco de Recursos / Bonos Prácticos por Nicho
// ─────────────────────────────────────────────────────────────────────

function buildBonuses(niche: NicheCode): Bonus[] {
  const byNiche: Record<NicheCode, Bonus[]> = {
    restaurante: [
      { id: "menu-wa", title: "Plantilla de Menú Digital Dinámico para WhatsApp", description: "Layout premium optimizado para compartir tu carta, que carga al instante en chats móviles." },
      { id: "loyalty-pos", title: "Guía de Fidelización con Código QR en Mesa", description: "Cómo sustituir las tarjetas físicas por un sistema de sellado digital que incentiva la recompra en el restaurante." },
    ],
    salud: [
      { id: "review-template", title: "Plantilla de WhatsApp para Solicitar Reseñas post-consulta", description: "Mensaje listo con anclaje al link de Google Business para acumular reputación médica positiva." },
      { id: "turnos-flow", title: "Setup de Turnos Online y Reducción de Ausentismo (No-shows)", description: "Esquema de confirmaciones automáticas que reduce ausencias de pacientes en un 40%." },
    ],
    retail: [
      { id: "gbp-checklist", title: "Lista de 25 Puntos Clave para Destacar en Google Maps Local", description: "Acciones para posicionar tu tienda física por encima de competidores de la zona." },
      { id: "ig-store", title: "Setup de Catálogo Integrado en Instagram Shopping", description: "Paso a paso para etiquetar tus productos en publicaciones de redes sociales para venta directa." },
    ],
    ecommerce: [
      { id: "klaviyo-flows", title: "Pack de 5 Secuencias Automáticas de Correo de Alto Impacto", description: "Plantillas completas para bienvenida, recuperación de carritos y fidelización post-compra." },
      { id: "upsell-checkout", title: "Estrategias de Venta Cruzada (Upsell) en el Checkout", description: "Cómo elevar el ticket de compra promedio del carrito en un 15-25% antes de pagar." },
    ],
    servicios_profesionales: [
      { id: "linkedin-strategy", title: "Plan de Publicación y Prospección en LinkedIn B2B", description: "Estrategia diaria y plantillas de contacto en frío para captar tomadores de decisión corporativos." },
      { id: "calendly-flow", title: "Flujo Automatizado de Calificación de Leads previa a Reunión", description: "Cuestionario dinámico conectado a Calendly que califica al prospecto antes de dar la cita." },
    ],
    educacion: [
      { id: "funnel-curso", title: "Embudo de Lanzamiento y Venta de Cursos Online", description: "Planificación paso a paso: lead magnet → nutrición → webinar de venta." },
      { id: "comunidad", title: "Setup de Comunidad Post-Curso para Retención", description: "Estructuración de canales exclusivos que elevan la recompra de futuras formaciones." },
    ],
    inmobiliario: [
      { id: "tour-virtual", title: "Setup de Tours Virtuales Inmobiliarios con Celular", description: "Cómo capturar propiedades en 360 grados usando aplicaciones móviles gratuitas." },
      { id: "wa-catalog", title: "Catálogo de Propiedades en WhatsApp Business", description: "Organiza tu inventario inmobiliario directamente dentro de tu canal de chat oficial." },
    ],
    fitness: [
      { id: "challenge-30", title: "Estructuración de Retos de 30 Días como Imán de Leads", description: "Estrategia para capturar correos en masa y convertirlos a membresías de pago." },
      { id: "referral-fitness", title: "Programa de Referidos 'Trae un amigo' para Socios", description: "Mecánica simple de incentivos cruzados para crecer tu gimnasio orgánicamente." },
    ],
    belleza: [
      { id: "booking-booksy", title: "Setup de Reservas Online y Depósitos Anticipados", description: "Cómo habilitar cobros parciales automáticos al reservar citas para evitar inasistencias." },
      { id: "ig-portfolio", title: "Grid y Portfolio Estético para Estilistas en Instagram", description: "Guía visual para estructurar tus historias destacadas y publicaciones antes/después." },
    ],
    agencia: [
      { id: "retainer-proposal", title: "Plantilla de Propuesta Comercial de Contratos Mensuales (Retainers)", description: "Layout de ventas enfocado en cerrar contratos de servicios recurrentes y no por proyectos sueltos." },
      { id: "outbound-li", title: "Guión de Mensajería para Prospectación Directa B2B", description: "Plantillas de mensaje corto probadas con tasas de respuesta de más del 25%." },
    ],
    turismo: [
      { id: "ota-vs-direct", title: "Estrategia para Desviar Reservas de OTAs a tu Canal Directo", description: "Mecánicas para fidelizar huéspedes de Booking para que reserven directo en tu web en el futuro." },
      { id: "wa-concierge", title: " WhatsApp como Conserje Digital durante la Estadía", description: "Cómo vender experiencias y extras del hotel a través de chat móvil." },
    ],
    automotriz: [
      { id: "service-reminder", title: "Sistema de Recordatorios de Mantenimiento Automatizados", description: "Lógica de notificaciones periódicas para que los clientes regresen a taller según kilometraje." },
      { id: "quote-pdf", title: "Plantilla de Presupuesto Técnico para Detailing y Taller", description: "Diseño visualmente claro que eleva la confianza y la tasa de aprobación de órdenes de trabajo." },
    ],
    construccion: [
      { id: "portfolio-construc", title: "Estructura de Portafolio de Obras Profesional", description: "Guía para documentar avances de obra paso a paso (brief, retos, fotos alta calidad, testimonio)." },
      { id: "warranties-sheet", title: "Ficha de Garantías y Sellos de Confianza", description: "Documento anexo a tus propuestas comerciales que duplica el ratio de firmas de contratos." },
    ],
    tecnologia: [
      { id: "pricing-saas", title: "Estructura de Precios SaaS de 3 Niveles Pertenecientes", description: "Anclaje de precios de tres planes diseñado para maximizar el ticket promedio de suscripción." },
      { id: "onboarding-saas", title: "Flujo de Bienvenida y Onboarding de Nuevos Usuarios", description: "Secuencia de emails y guías in-app para reducir el abandono inicial del software." },
    ],
    otro: [
      { id: "wa-base", title: "Setup de WhatsApp Business desde Cero", description: "Catálogo, respuestas rápidas, etiquetas y automatizaciones básicas." },
      { id: "automation-make", title: "5 Automatizaciones Clave con Make/Zapier", description: "Conexiones sencillas para ahorrar más de 10 horas de trabajo administrativo al mes." },
    ],
  };

  return byNiche[niche] ?? byNiche.otro;
}

// ─────────────────────────────────────────────────────────────────────
// Composición de Síntesis Ejecutiva en Prosa
// ─────────────────────────────────────────────────────────────────────

function composeSummary(
  a: WebAuditResult,
  answers: SurveyAnswers,
  segment: Segment,
  niche: NicheCode,
  size: SizeCode,
  scores: ScoreBreakdown
): string {
  const nicheLabel = findNiche(niche)?.label.toLowerCase() ?? "negocio";
  const sizeLabel = findSize(size)?.label.toLowerCase() ?? "negocio";

  const segmentText: Record<Segment, string> = {
    emprendimiento:
      "Tu negocio se encuentra en una fase inicial o de cimientos digitales. Actualmente tu tecnología y procesos presentan fricciones manuales significativas que te quitan tiempo y restan velocidad comercial. Las prioridades absolutas deben enfocarse en montar las bases técnicas y de contacto claro.",
    pequeno:
      "Operas un negocio pequeño con cierta presencia digital establecida, pero existen fugas importantes en tu embudo técnico (falta de velocidad, tracking de conversión nulo o canales de contacto dispersos). Tienes una gran oportunidad para sistematizar cimientos y empezar a medir.",
    crecimiento:
      "Tu negocio está en fase de crecimiento sostenido. El pilar comercial y de adquisición requiere mayor automatización y cimientos estables para no depender enteramente del boca a boca. La palanca de mayor ROI inmediato está en integrar tus sistemas y optimizar tus flujos.",
    establecido:
      "Cuentas con una estructura de negocio establecida. La tecnología actual debe optimizarse a nivel de automatización avanzada de procesos de trabajo y consolidación de marca para evitar ineficiencias internas a medida que escalas.",
  };

  const issues: string[] = [];
  if (a.reachable) {
    if (!a.https) issues.push("sitio web no seguro (sin HTTPS)");
    if (!a.has_viewport_meta) issues.push("sitio no responsive en móvil");
    if (!a.has_google_analytics) issues.push("ausencia de Google Analytics");
    if (!a.has_meta_pixel) issues.push("sin píxel de conversión Meta");
    if (a.response_time_ms !== null && a.response_time_ms > 3000) issues.push("servidor web lento");
  } else {
    issues.push("sitio web inaccesible");
  }

  const issuesText =
    issues.length > 0
      ? `A nivel técnico de tu web, detectamos las siguientes prioridades a corregir: ${issues.join(", ")}.`
      : "Los cimientos técnicos y de seguridad de tu web se detectaron en buen estado.";

  const techSatisfaction = (answers.tech_satisfaction as string) ?? "";
  const satisfactionText =
    techSatisfaction === "unsatisfied"
      ? "Declaras una alta insatisfacción tecnológica en tu negocio, lo cual frena a tu equipo."
      : techSatisfaction === "partially_satisfied"
      ? "Declaras que tus herramientas actuales están aisladas, lo que duplica el trabajo manual."
      : "";

  return (
    `Tu ${nicheLabel} (${sizeLabel}) tiene un score de salud técnica global de ${scores.overall}/100. ` +
    `${segmentText[segment]} ` +
    `${issuesText} ` +
    (satisfactionText ? `${satisfactionText} ` : "") +
    `Las recomendaciones de este diagnóstico están calculadas estrictamente para mejorar la eficiencia de tus procesos internos y potenciar tu área digital de forma realista y alcanzable.`
  );
}
