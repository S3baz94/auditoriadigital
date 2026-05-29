// Servicio de notificaciones por correo electrónico de PulseAudit.
// Envía alertas automáticas por correo electrónico al administrador con el diagnóstico
// de negocio completo y las propuestas de valor recomendadas para vender.

import nodemailer from "nodemailer";
import type { WebAuditResult } from "./webAudit.js";
import type { ExecutiveReport, ScoreBreakdown } from "./reportEngine.js";

interface NotificationEmailParams {
  businessName: string;
  websiteUrl: string;
  nicheLabel: string;
  sizeLabel: string;
  segmentLabel: string;
  scores: ScoreBreakdown;
  answers: Record<string, string>;
  audit: WebAuditResult;
  report: ExecutiveReport;
}

export async function sendAuditNotification(params: NotificationEmailParams): Promise<void> {
  const smtpUser = process.env.NOTIF_SMTP_USER;
  const smtpPass = process.env.NOTIF_SMTP_PASS;
  const smtpHost = process.env.NOTIF_SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.NOTIF_SMTP_PORT) || 587;
  const emailTo = process.env.NOTIF_EMAIL_TO || "sebastiansachezramos@gmail.com";

  if (!smtpUser || !smtpPass) {
    console.warn(
      "[PulseAudit Mailer] SMTP no configurado. Las variables NOTIF_SMTP_USER y NOTIF_SMTP_PASS no están presentes en el entorno. Se simula el correo exitosamente en consola."
    );
    console.log(`✉️ [Simulador de Correo] Nuevo diagnóstico de: "${params.businessName}"`);
    console.log(`- Web: ${params.websiteUrl}`);
    console.log(`- Segmento: ${params.segmentLabel} (Score: ${params.scores.overall}/100)`);
    console.log(`- Opciones a ofrecer al cliente:`);
    const options = calculateSalesOptions(params);
    options.forEach((opt, idx) => console.log(`  ${idx + 1}. [${opt.service}]: ${opt.reason}`));
    return;
  }

  // Configuración del transporter de Nodemailer
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const salesOptions = calculateSalesOptions(params);
  const salesHtmlList = salesOptions
    .map(
      (opt) => `
      <li style="margin-bottom: 12px; line-height: 1.5; color: #1e293b;">
        <strong style="color: #6366f1; font-size: 1.05rem;">${opt.service}</strong><br/>
        <span style="font-size: 0.9rem; color: #475569;">${opt.reason}</span>
      </li>
    `
    )
    .join("");

  const answerRows = Object.entries(params.answers)
    .map(([key, val]) => {
      const qText = getQuestionLabel(key);
      const optText = getOptionLabel(key, val);
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; color: #475569; width: 50%;"><strong>${qText}</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; color: #1e293b;">${optText}</td>
        </tr>
      `;
    })
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Nuevo Diagnóstico PulseAudit</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em;">PulseAudit</h1>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">¡Nuevo Prospecto Cualificado Detectado!</p>
          </div>
          
          <!-- Contenido -->
          <div style="padding: 24px;">
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 1.3rem;">Ficha del Prospecto</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 0.88rem; width: 35%;">Negocio:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 0.88rem; font-weight: 600;">${params.businessName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 0.88rem;">Sitio Web:</td>
                <td style="padding: 6px 0; color: #4f46e5; font-size: 0.88rem; font-weight: 600;">
                  <a href="${params.websiteUrl}" target="_blank" style="color: #4f46e5; text-decoration: none;">${params.websiteUrl}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 0.88rem;">Nicho / Tamaño:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 0.88rem;">${params.nicheLabel} (${params.sizeLabel})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 0.88rem;">Segmento:</td>
                <td style="padding: 6px 0; color: #10b981; font-size: 0.88rem; font-weight: 600;">${params.segmentLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 0.88rem;">Score Global:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 0.88rem; font-weight: 600;">${params.scores.overall}/100</td>
              </tr>
            </table>

            <!-- SECCIÓN ESTRELLA: SERVICIOS A OFRECER -->
            <div style="background-color: #f1f5f9; border-left: 4px solid #6366f1; border-radius: 4px 8px 8px 4px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;">
                💡 Propuestas Sugeridas a Vender
              </h3>
              <ul style="margin: 0; padding-left: 1.25rem;">
                ${salesHtmlList || `<li style="font-size:0.9rem; color:#475569;">No se detectaron necesidades críticas de desarrollo a medida para este perfil.</li>`}
              </ul>
            </div>

            <!-- RESPUESTAS DEL CUESTIONARIO -->
            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.05rem;">Respuestas del Diagnóstico</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead style="background-color: #f8fafc;">
                <tr>
                  <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Pregunta</th>
                  <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Respuesta</th>
                </tr>
              </thead>
              <tbody>
                ${answerRows}
              </tbody>
            </table>

            <!-- RESUMEN TÉCNICO -->
            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.05rem;">Scores por Pilar</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 24px;">
              <div style="background: #fafafa; border: 1px solid #eaeaea; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Cimientos</span><br/>
                <strong style="font-size:1.2rem; color:#0f172a;">${params.scores.web_foundation}%</strong>
              </div>
              <div style="background: #fafafa; border: 1px solid #eaeaea; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">SEO</span><br/>
                <strong style="font-size:1.2rem; color:#0f172a;">${params.scores.seo}%</strong>
              </div>
              <div style="background: #fafafa; border: 1px solid #eaeaea; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Medición</span><br/>
                <strong style="font-size:1.2rem; color:#0f172a;">${params.scores.tracking}%</strong>
              </div>
              <div style="background: #fafafa; border: 1px solid #eaeaea; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Conversión</span><br/>
                <strong style="font-size:1.2rem; color:#0f172a;">${params.scores.conversion}%</strong>
              </div>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="https://vercel.com/sebastiansachezramos-5215s-projects/leadpulse" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.9rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
                Ver en Vercel Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"PulseAudit Alerta" <${smtpUser}>`,
      to: emailTo,
      subject: `🔥 Nuevo Diagnóstico: ${params.businessName} (${params.scores.overall}/100)`,
      html: emailHtml,
    });
    console.log(`[PulseAudit Mailer] Alerta enviada con éxito a ${emailTo}`);
  } catch (err) {
    console.error(
      `[PulseAudit Mailer] Fallo al enviar correo electrónico por SMTP: ${
        err instanceof Error ? err.message : "error desconocido"
      }`
    );
  }
}

// ── Lógica de Sugerencia de Venta en base a respuestas ──────────────────

interface SalesOption {
  service: string;
  reason: string;
}

function calculateSalesOptions(params: NotificationEmailParams): SalesOption[] {
  const options: SalesOption[] = [];
  const ans = params.answers;
  const a = params.audit;

  // 1. Venta de Páginas Web a Medida / CRO:
  const isSlow = a.reachable && a.response_time_ms !== null && a.response_time_ms > 3000;
  const notResponsive = a.reachable && !a.has_viewport_meta;
  const notSecure = a.reachable && !a.https;
  const lowWebPillar = params.scores.web_foundation < 60 || params.scores.conversion < 60;

  if (isSlow || notResponsive || notSecure || lowWebPillar || !a.reachable) {
    options.push({
      service: "Desarrollo de Página Web a Medida (CRO & Velocidad)",
      reason: `El sitio web actual del prospecto presenta fallas críticas de rendimiento (${
        isSlow ? "Velocidad de carga lenta de " + a.response_time_ms + "ms" : ""
      }${notResponsive ? "No es responsivo/amigable en móviles" : ""}${
        notSecure ? "No cuenta con certificado seguro SSL/HTTPS" : ""
      }). Ofrécele un rediseño moderno centrado en conversiones y optimización técnica absoluta.`,
    });
  }

  // 2. Venta de Aplicación Web o Software Personalizado (CRM / Panel de Tareas):
  const manualOps = ans.operations_coordination === "manual";
  const unsatisfiedTech = ans.tech_satisfaction === "unsatisfied" || ans.tech_satisfaction === "partially_satisfied";

  if (manualOps || unsatisfiedTech) {
    options.push({
      service: "Desarrollo de Aplicación Web a Medida (Portal / CRM / ERP Interno)",
      reason: `El prospecto declaró llevar su coordinación interna y tareas de forma MANUAL (papel, Excel) y experimentar una alta insatisfacción tecnológica en su negocio. Ofrécele una app a medida para centralizar su flujo de trabajo operativo y automatizar asignaciones al equipo.`,
    });
  }

  // 3. Venta de Integraciones / CRM de Ventas / Automatización:
  const noFollowup = ans.sales_followup === "none" || ans.sales_followup === "manual";
  const slowLeadResponse = ans.response_time === "day_or_two" || ans.response_time === "more_than_48";

  if (noFollowup || slowLeadResponse) {
    options.push({
      service: "Implementación e Integración de CRM + Bots Automatizados",
      reason: `El prospecto pierde leads por un seguimiento comercial deficiente (${
        noFollowup ? "Seguimiento de cotizaciones ausente o manual" : ""
      }${
        slowLeadResponse ? "Tardanza de más de 24 horas en responder a leads nuevos" : ""
      }). Ofrécele la integración de un CRM automatizado (HubSpot/Notion) y la configuración de bots de respuestas automáticas en WhatsApp y formularios web.`,
    });
  }

  // 4. Venta de Máquina de Inbound (Local SEO + Pauta):
  const highlyVariableRevenue = ans.revenue_stability === "highly_variable";
  const referralDependent = ans.acquisition_channel === "referrals";

  if (highlyVariableRevenue && referralDependent) {
    options.push({
      service: "Embudo de Inbound Marketing (SEO Local + Google Ads + Landing)",
      reason: "El negocio sufre de ingresos inestables mes a mes y depende 100% de recomendaciones de boca a boca. Ofrécele un embudo de captación estructurado para inyectar prospectos predecibles.",
    });
  }

  return options;
}

// ── Mapeadores de Textos para el Correo HTML ────────────────────────────

function getQuestionLabel(id: string): string {
  const labels: Record<string, string> = {
    acquisition_channel: "¿Cuál es tu principal canal de atracción?",
    response_time: "¿Cuánto tardas en responder a prospectos?",
    referral_frequency: "¿Tus clientes recomiendan tu negocio?",
    goal_6m: "¿Cuál es tu meta estratégica a 6 meses?",
    operations_coordination: "¿Cómo gestionas el día a día y tareas?",
    tech_satisfaction: "¿Nivel de satisfacción con tu tecnología?",
    revenue_stability: "¿Estabilidad de tus ingresos actuales?",
    pricing_strategy: "¿Cómo defines tus precios/tarifas?",
    sales_followup: "¿Cómo manejas el seguimiento de propuestas?",
  };
  return labels[id] || id;
}

function getOptionLabel(id: string, val: string): string {
  const options: Record<string, Record<string, string>> = {
    acquisition_channel: {
      referrals: "Recomendaciones (boca a boca)",
      paid_ads: "Publicidad de pago (FB/Google Ads)",
      organic_social: "Redes sociales orgánicas",
      outbound: "Prospección directa / ventas frías",
    },
    response_time: {
      minutes: "Minutos (inmediato)",
      hours: "Unas pocas horas",
      day_or_two: "De 24 a 48 horas",
      more_than_48: "Más de 48 horas",
    },
    referral_frequency: {
      always: "Constantemente (nuestro motor)",
      sometimes: "Ocasionalmente (solo si les preguntan)",
      never: "Rara vez o nunca nos recomiendan",
    },
    goal_6m: {
      more_clients: "Conseguir nuevos clientes / expansión",
      more_revenue: "Aumentar ticket promedio / ventas",
      retention: "Fidelizar / recompras",
      automate: "Automatizar procesos para ahorrar costos",
    },
    operations_coordination: {
      automated: "Software de proyectos dedicado",
      basic_tools: "WhatsApp o tableros Trello",
      manual: "Manual en papel, libretas o Excel",
    },
    tech_satisfaction: {
      very_satisfied: "Muy satisfecho (integrado y rápido)",
      partially_satisfied: "Parcialmente satisfecho (aislados)",
      unsatisfied: "Insatisfecho (fricción constante)",
    },
    revenue_stability: {
      highly_variable: "Muy variable e impredecible",
      stable_flat: "Estable pero plano",
      growing: "Crecimiento constante y predecible",
    },
    pricing_strategy: {
      premium: "Precios premium basados en valor",
      cost_plus: "Margen sumado sobre costos",
      market: "Competir por precio con el mercado",
      unclear: "Sin estrategia clara",
    },
    sales_followup: {
      crm: "CRM estructurado",
      manual: "Manual en agenda o por correo",
      none: "Sin seguimiento sistemático",
    },
  };

  return options[id]?.[val] || val;
}
