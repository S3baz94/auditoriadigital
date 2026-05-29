import "./style.css";
import { api, toast } from "./api";

type View = "dashboard" | "create_audit" | "audit_report";

interface NicheDef {
  code: string;
  label: string;
  emoji: string;
  description: string;
}

interface SizeDef {
  code: string;
  label: string;
  description: string;
}

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  type: string;
  question: string;
  helper?: string;
  options?: QuestionOption[];
}

interface AuditRow {
  id: string;
  business_name: string;
  website_url: string;
  niche: string;
  size: string;
  overall_score: number | null;
  status: string;
  created_at: string;
  segment?: string | null;
}

interface ScoreBreakdown {
  web_foundation: number;
  seo: number;
  tracking: number;
  conversion: number;
  social_presence: number;
  overall: number;
}

interface Finding {
  area: "web" | "seo" | "tracking" | "conversion" | "social" | "negocio";
  severity: "good" | "warn" | "bad";
  title: string;
  detail: string;
}

interface SolutionStep {
  id: string;
  title: string;
  impact: "alto" | "medio" | "bajo";
  effort: "bajo" | "medio" | "alto";
  category: string;
  why: string;
  steps: string[];
}

interface Bonus {
  id: string;
  title: string;
  description: string;
}

interface AuditReportResponse {
  id: string;
  business_name: string;
  website_url: string;
  niche: string;
  size: string;
  geo?: string | null;
  survey: Record<string, string>;
  report: {
    segment: "emprendimiento" | "pequeno" | "crecimiento" | "establecido";
    segment_label: string;
    niche_label: string;
    size_label: string;
    executive_summary: string;
    scores: ScoreBreakdown;
    findings: Finding[];
    solution_system: SolutionStep[];
    bonuses: Bonus[];
  };
}

// ── Variables de Estado Global ──────────────────────────────────────────
const app = document.getElementById("app")!;
let currentView: View = "dashboard";
let selectedAuditId: string | null = null;

// Catálogos estáticos (coincidentes con backend)
const NICHES: NicheDef[] = [
  { code: "restaurante", label: "Restaurante / Cafetería", emoji: "🍽️", description: "Comida, bebida y gastronomía" },
  { code: "salud", label: "Salud / Consultorio", emoji: "⚕️", description: "Médicos, dentistas, clínicas" },
  { code: "retail", label: "Tienda física / Local", emoji: "🏪", description: "Venta física local" },
  { code: "ecommerce", label: "E-commerce / Tienda online", emoji: "🛒", description: "Venta de productos en línea" },
  { code: "servicios_profesionales", label: "Servicios / Consultoría", emoji: "💼", description: "Abogados, contadores, coaches" },
  { code: "educacion", label: "Educación / Academia", emoji: "🎓", description: "Cursos, capacitaciones" },
  { code: "inmobiliario", label: "Inmobiliaria", emoji: "🏠", description: "Propiedades y corretaje" },
  { code: "fitness", label: "Fitness / Gimnasio", emoji: "💪", description: "Deportes, entrenadores" },
  { code: "belleza", label: "Estética / Spa", emoji: "💇", description: "Peluquería, belleza" },
  { code: "agencia", label: "Agencia / Creativo", emoji: "🎨", description: "Marketing, diseño, software" },
  { code: "turismo", label: "Turismo / Hotel", emoji: "✈️", description: "Viajes y experiencias" },
  { code: "automotriz", label: "Automotriz / Taller", emoji: "🚗", description: "Vehículos, repuestos" },
  { code: "construccion", label: "Construcción / Reformas", emoji: "🔨", description: "Arquitectos, remodelaciones" },
  { code: "tecnologia", label: "Tecnología / Software", emoji: "💻", description: "Apps, SaaS, servicios IT" },
  { code: "otro", label: "Otro tipo de negocio", emoji: "🏢", description: "Otros rubros" },
];

const SIZES: SizeDef[] = [
  { code: "solo", label: "Emprendimiento individual", description: "Solo yo (sin empleados)" },
  { code: "micro", label: "Microempresa", description: "2 a 10 personas" },
  { code: "pequena", label: "Pequeña empresa", description: "11 a 50 personas" },
  { code: "mediana", label: "Mediana o grande", description: "Más de 50 personas" },
];

// Las 9 Preguntas de Diagnóstico de Negocio Reordenadas en 3 Ejes
const QUESTIONS: Question[] = [
  // ── EJE 1: SERVICIOS (Clientes & Canales) ──
  {
    id: "acquisition_channel",
    type: "single",
    question: "¿Cuál es tu principal canal para atraer nuevos clientes hoy?",
    helper: "Eje 1: Servicios. Entiende cómo llegan tus leads en este momento.",
    options: [
      { value: "referrals", label: "Recomendaciones de clientes existentes (boca a boca)" },
      { value: "paid_ads", label: "Publicidad digital de pago (Facebook, Instagram, Google)" },
      { value: "organic_social", label: "Redes sociales de manera orgánica (sin pagar publicidad)" },
      { value: "outbound", label: "Prospección directa o ventas frías (llamadas, visitas)" },
    ],
  },
  {
    id: "response_time",
    type: "single",
    question: "¿Cuánto tiempo pasa en promedio desde que un cliente potencial te contacta hasta que recibe respuesta o cotización?",
    helper: "Eje 1: Servicios. En digital, responder velozmente evita fugas comerciales.",
    options: [
      { value: "minutes", label: "Minutos (atención casi inmediata)" },
      { value: "hours", label: "Unas pocas horas" },
      { value: "day_or_two", label: "De 24 a 48 horas" },
      { value: "more_than_48", label: "Más de 48 horas" },
    ],
  },
  {
    id: "referral_frequency",
    type: "single",
    question: "¿Con qué frecuencia tus clientes actuales recomiendan tu negocio de forma activa?",
    helper: "Eje 1: Servicios. Indica el nivel de lealtad y satisfacción de tu servicio actual.",
    options: [
      { value: "always", label: "Constantemente, el boca a boca es nuestro motor principal" },
      { value: "sometimes", label: "Ocasionalmente, solo si alguien les pregunta de forma directa" },
      { value: "never", label: "Rara vez o nunca nos recomiendan de forma activa" },
    ],
  },

  // ── EJE 2: PRODUCTO & OPERACIÓN (Tecnología & Gestión) ──
  {
    id: "goal_6m",
    type: "single",
    question: "¿Cuál es tu enfoque prioritario para los próximos 6 meses?",
    helper: "Eje 2: Producto & Operación. Define tus objetivos principales de escala.",
    options: [
      { value: "more_clients", label: "Conseguir nuevos clientes o expandir mercado" },
      { value: "more_revenue", label: "Aumentar el ticket promedio de compra o ventas" },
      { value: "retention", label: "Fidelizar y hacer que los clientes actuales recompren" },
      { value: "automate", label: "Automatizar procesos internos para ahorrar tiempo y costos" },
    ],
  },
  {
    id: "operations_coordination",
    type: "single",
    question: "¿Cómo gestionas las tareas y la coordinación del día a día con tu equipo?",
    helper: "Eje 2: Producto & Operación. Mide el nivel de digitalización operativa diaria.",
    options: [
      { value: "automated", label: "Totalmente automatizado con software de gestión de proyectos dedicado" },
      { value: "basic_tools", label: "Herramientas básicas como chats de WhatsApp o tableros de Trello" },
      { value: "manual", label: "Procesos manuales apoyados en papel, libretas o tablas de Excel" },
    ],
  },
  {
    id: "tech_satisfaction",
    type: "single",
    question: "¿Qué tan satisfecho estás con las herramientas tecnológicas actuales de tu negocio?",
    helper: "Eje 2: Producto & Operación. Mide el nivel de fricción técnica interna.",
    options: [
      { value: "very_satisfied", label: "Muy satisfecho, todo funciona integrado y rápido" },
      { value: "partially_satisfied", label: "Parcialmente satisfecho, algunas herramientas nos limitan o están aisladas" },
      { value: "unsatisfied", label: "Insatisfecho, la tecnología nos genera más fricción y problemas" },
    ],
  },

  // ── EJE 3: PRECIO & COMERCIAL (Finanzas & CRM) ──
  {
    id: "revenue_stability",
    type: "single",
    question: "¿Cómo calificarías la estabilidad de tus ingresos actuales?",
    helper: "Eje 3: Precio & Comercial. Evalúa la predictibilidad financiera de tu flujo.",
    options: [
      { value: "highly_variable", label: "Muy variable e impredecible mes a mes" },
      { value: "stable_flat", label: "Estable, pero plano y sin crecimiento" },
      { value: "growing", label: "Crecimiento constante y predecible" },
    ],
  },
  {
    id: "pricing_strategy",
    type: "single",
    question: "¿Cómo defines los precios de tus productos o servicios?",
    helper: "Eje 3: Precio & Comercial. Analiza tu posicionamiento en valor y márgenes.",
    options: [
      { value: "premium", label: "Precios premium basados en el valor que percibe el cliente" },
      { value: "cost_plus", label: "Margen fijo sumado sobre nuestros costos estimados" },
      { value: "market", label: "Alineados con el mercado para competir por precio con la competencia" },
      { value: "unclear", label: "No tengo una estrategia de precios estructurada" },
    ],
  },
  {
    id: "sales_followup",
    type: "single",
    question: "¿Cómo manejas el seguimiento de las propuestas o cotizaciones enviadas?",
    helper: "Eje 3: Precio & Comercial. Evalúa el ratio de cierre y recuperación comercial.",
    options: [
      { value: "crm", label: "Usamos un CRM estructurado para registrar y dar seguimiento" },
      { value: "manual", label: "De forma manual, agendando recordatorios o por correo directo" },
      { value: "none", label: "No realizamos un seguimiento sistemático" },
    ],
  },
];

// Estructura del Wizard de Creación
interface WizardState {
  step: 1 | 2 | 3;
  business_name: string;
  website_url: string;
  instagram_url: string;
  linkedin_url: string;
  niche: string;
  size: string;
  current_question_index: number;
  answers: Record<string, string>;
}

let wizard: WizardState = {
  step: 1,
  business_name: "",
  website_url: "",
  instagram_url: "",
  linkedin_url: "",
  niche: "",
  size: "",
  current_question_index: 0,
  answers: {},
};

// ── Shell General y Navegación ─────────────────────────────────────────

function shell(content: string): void {
  app.innerHTML = `
    <div class="layout">
      <button class="hamburger" id="hamburger" aria-label="Menú">☰</button>
      <aside class="sidebar" id="sidebar">
        <div>
          <div class="logo">Pulse<span>Audit</span></div>
          <p class="tagline">Diagnóstico & Estrategia Digital B2B</p>
          <nav class="nav">
            ${navBtn("dashboard", "📋 Diagnósticos")}
            <button type="button" id="btn-nav-new-audit">✨ Nuevo Diagnóstico</button>
          </nav>
        </div>
        <div style="font-size: 0.72rem; color: var(--muted); border-top: 1px solid var(--border); padding-top: 1rem;">
          <p>PulseAudit v3.1.0</p>
          <p>Plataforma de Cualificación B2B</p>
        </div>
      </aside>
      <main id="main-content">${content}</main>
    </div>
  `;

  // Listeners de navegación
  document.querySelectorAll(".nav button").forEach((b) => {
    b.addEventListener("click", () => {
      currentView = (b as HTMLButtonElement).dataset.view as View;
      document.getElementById("sidebar")?.classList.remove("open");
      render();
    });
  });

  document.getElementById("btn-nav-new-audit")?.addEventListener("click", () => {
    resetWizard();
    currentView = "create_audit";
    document.getElementById("sidebar")?.classList.remove("open");
    render();
  });

  document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
  });
}

function navBtn(view: View, label: string): string {
  const active = currentView === view ? "class='active'" : "";
  return `<button type="button" ${active} data-view="${view}">${label}</button>`;
}

async function render(): Promise<void> {
  try {
    switch (currentView) {
      case "dashboard":
        await renderDashboard();
        break;
      case "create_audit":
        renderCreateAudit();
        break;
      case "audit_report":
        await renderAuditReport();
        break;
    }
  } catch (e) {
    shell(`<p style="color:var(--danger)">Error: ${e instanceof Error ? e.message : "unknown"}</p>`);
  }
}

function resetWizard(): void {
  wizard = {
    step: 1,
    business_name: "",
    website_url: "",
    instagram_url: "",
    linkedin_url: "",
    niche: "",
    size: "",
    current_question_index: 0,
    answers: {},
  };
}

// ── VISTA 1: Dashboard (Listado de Diagnósticos) ──────────────────────────

async function renderDashboard(): Promise<void> {
  shell(`
    <h1>Diagnósticos Digitales</h1>
    <p class="sub">Listado de diagnósticos estratégicos y auditorías técnicas automatizadas.</p>
    
    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1rem">
        <h2>Auditorías Recientes</h2>
        <button class="btn" id="btn-start-audit">✨ Iniciar Nueva Auditoría</button>
      </div>
      
      <div style="overflow-x:auto">
        <table id="dashboard-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Clasificación</th>
              <th>Score</th>
              <th>Sitio Web</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="6" style="color:var(--muted); text-align:center">Cargando diagnósticos...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById("btn-start-audit")?.addEventListener("click", () => {
    resetWizard();
    currentView = "create_audit";
    render();
  });

  try {
    const { diagnostics } = await api<{ diagnostics: AuditRow[] }>("/api/diagnostics");
    const tbody = document.querySelector("#dashboard-table tbody")!;

    if (!diagnostics || diagnostics.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted); text-align:center">Aún no hay diagnósticos realizados. ¡Inicia el primero!</td></tr>`;
      return;
    }

    tbody.innerHTML = diagnostics
      .map((d) => {
        const score = d.overall_score;
        const scoreBadge =
          score === null
            ? `<span class="badge warn">Pendiente</span>`
            : score >= 75
            ? `<span class="badge good">${score}/100</span>`
            : score >= 50
            ? `<span class="badge warn">${score}/100</span>`
            : `<span class="badge bad">${score}/100</span>`;

        const segmentBadge = d.segment
          ? `<span class="badge good">${d.segment.toUpperCase()}</span>`
          : `<span class="badge warn">Sin Segmentar</span>`;

        const cleanDate = new Date(d.created_at).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        return `
          <tr>
            <td><strong>${d.business_name}</strong><br/><span style="font-size:0.75rem; color:var(--muted)">${d.niche}</span></td>
            <td>${segmentBadge}</td>
            <td>${scoreBadge}</td>
            <td><a href="${d.website_url}" target="_blank" style="color:var(--accent-2); text-decoration:none">${d.website_url.replace(/https?:\/\//i, "")}</a></td>
            <td>${cleanDate}</td>
            <td style="text-align:right">
              <button class="btn secondary btn-sm btn-open-report" data-id="${d.id}">📄 Abrir Reporte</button>
            </td>
          </tr>
        `;
      })
      .join("");

    document.querySelectorAll(".btn-open-report").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedAuditId = (btn as HTMLButtonElement).dataset.id || null;
        currentView = "audit_report";
        render();
      });
    });
  } catch (err) {
    console.error(err);
    const tbody = document.querySelector("#dashboard-table tbody")!;
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger); text-align:center">Error al conectar con la base de datos local o de Vercel.</td></tr>`;
  }
}

// ── VISTA 2: Creación de Diagnóstico (Wizard por Pasos) ──────────────────

function renderCreateAudit(): void {
  if (wizard.step === 1) {
    renderWizardStep1();
  } else if (wizard.step === 2) {
    renderWizardStep2();
  } else if (wizard.step === 3) {
    renderWizardStep3();
  }
}

// Paso 1: Identificación, Nicho, Tamaño y Enlaces
function renderWizardStep1(): void {
  const progressHtml = `<div class="wizard-progress"><div class="wizard-progress-bar" style="width: 15%"></div></div>`;
  
  const nicheCards = NICHES.map((n) => `
    <div class="select-card niche-card ${wizard.niche === n.code ? "active" : ""}" data-code="${n.code}">
      <span class="emoji">${n.emoji}</span>
      <h3>${n.label}</h3>
      <p>${n.description}</p>
    </div>
  `).join("");

  const sizeCards = SIZES.map((s) => `
    <div class="select-card size-card ${wizard.size === s.code ? "active" : ""}" data-code="${s.code}">
      <h3>${s.label}</h3>
      <p>${s.description}</p>
    </div>
  `).join("");

  shell(`
    <h1>Nuevo Diagnóstico General</h1>
    <p class="sub">Paso 1: Identificación básica. Registra tu nombre y los enlaces que analizaremos en segundo plano.</p>
    
    ${progressHtml}
    
    <div class="panel">
      <h2>1. Datos del Negocio</h2>
      <form id="form-step-1">
        <div class="form-row">
          <label>Nombre del Negocio
            <input name="business_name" value="${wizard.business_name}" placeholder="Ej: Clínica Dental Sonrisas" required />
          </label>
          <label>Sitio Web Oficial
            <input name="website_url" value="${wizard.website_url}" placeholder="Ej: www.tusitio.com" required />
          </label>
        </div>
        
        <h2 style="margin-top:2rem; margin-bottom:1rem">2. Enlaces a Redes Sociales (Para Análisis)</h2>
        <div class="form-row">
          <label>Enlace de Instagram
            <input name="instagram_url" value="${wizard.instagram_url}" placeholder="https://www.instagram.com/tu_cuenta" />
          </label>
          <label>Enlace de LinkedIn
            <input name="linkedin_url" value="${wizard.linkedin_url}" placeholder="https://www.linkedin.com/company/tu_empresa" />
          </label>
        </div>
        
        <h2 style="margin-top:2rem; margin-bottom:1rem">3. Selecciona tu Nicho</h2>
        <div class="grid-select" style="margin-bottom:2rem">${nicheCards}</div>
        
        <h2 style="margin-top:2rem; margin-bottom:1rem">4. Tamaño de la Organización</h2>
        <div class="grid-select" style="margin-bottom:2rem">${sizeCards}</div>
        
        <div style="display:flex; justify-content:flex-end; margin-top:2rem">
          <button type="submit" class="btn" id="btn-submit-step-1" ${!wizard.niche || !wizard.size ? "disabled" : ""}>Siguiente: Diagnóstico B2B →</button>
        </div>
      </form>
    </div>
  `);

  // Listeners de selección de Nicho
  document.querySelectorAll(".niche-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".niche-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      wizard.niche = (card as HTMLElement).dataset.code || "";
      validateStep1Submit();
    });
  });

  // Listeners de selección de Tamaño
  document.querySelectorAll(".size-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".size-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      wizard.size = (card as HTMLElement).dataset.code || "";
      validateStep1Submit();
    });
  });

  function validateStep1Submit() {
    const btn = document.getElementById("btn-submit-step-1") as HTMLButtonElement;
    if (wizard.niche && wizard.size) {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  }

  document.getElementById("form-step-1")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    wizard.business_name = fd.get("business_name") as string;
    wizard.website_url = fd.get("website_url") as string;
    wizard.instagram_url = fd.get("instagram_url") as string;
    wizard.linkedin_url = fd.get("linkedin_url") as string;
    
    wizard.step = 2;
    wizard.current_question_index = 0;
    renderCreateAudit();
  });
}

// Paso 2: Las 9 Preguntas Divididas en 3 Ejes (Servicios, Productos, Precio)
function renderWizardStep2(): void {
  const index = wizard.current_question_index;
  const q = QUESTIONS[index];
  const total = QUESTIONS.length;
  
  // Calcular el eje actual
  let ejeTitle = "EJE 1: SERVICIOS (Clientes & Canales)";
  let ejeStepHtml = `
    <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.78rem; text-transform:uppercase; font-family:var(--display); font-weight:700; color:var(--muted)">
      <span style="color:var(--accent-2)">● 1. Servicios</span>
      <span>○ 2. Productos & Operación</span>
      <span>○ 3. Precio & Comercial</span>
    </div>
  `;

  if (index >= 3 && index < 6) {
    ejeTitle = "EJE 2: PRODUCTOS & OPERACIÓN (Tecnología & Gestión)";
    ejeStepHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.78rem; text-transform:uppercase; font-family:var(--display); font-weight:700; color:var(--muted)">
        <span style="color:var(--success)">✓ 1. Servicios</span>
        <span style="color:var(--accent-2)">● 2. Productos & Operación</span>
        <span>○ 3. Precio & Comercial</span>
      </div>
    `;
  } else if (index >= 6) {
    ejeTitle = "EJE 3: PRECIO & COMERCIAL (Finanzas & Ventas)";
    ejeStepHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.78rem; text-transform:uppercase; font-family:var(--display); font-weight:700; color:var(--muted)">
        <span style="color:var(--success)">✓ 1. Servicios</span>
        <span style="color:var(--success)">✓ 2. Productos & Operación</span>
        <span style="color:var(--accent-2)">● 3. Precio & Comercial</span>
      </div>
    `;
  }

  const pct = Math.round(((index + 1) / total) * 100);
  const progressHtml = `<div class="wizard-progress"><div class="wizard-progress-bar" style="width: ${pct}%"></div></div>`;

  const optionCards = q.options?.map((opt) => {
    const isActive = wizard.answers[q.id] === opt.value ? "active" : "";
    return `
      <div class="select-card option-card ${isActive}" data-val="${opt.value}">
        <h3>${opt.label}</h3>
      </div>
    `;
  }).join("") || "";

  shell(`
    <h1 style="font-size:1.85rem">${ejeTitle}</h1>
    <p class="sub">Pregunta ${index + 1} de ${total}: Responde de forma transparente para generar tu hoja de ruta.</p>
    
    ${ejeStepHtml}
    ${progressHtml}
    
    <div class="panel">
      <h2>${q.question}</h2>
      ${q.helper ? `<p style="color:var(--muted); font-size:0.88rem; margin-bottom:1.5rem">${q.helper}</p>` : ""}
      
      <div class="grid-select" style="margin-top:1.5rem; margin-bottom:2rem">${optionCards}</div>
      
      <div style="display:flex; justify-content:space-between; margin-top:2rem">
        <button class="btn secondary" id="btn-prev-question" ${index === 0 ? "disabled" : ""}>← Atrás</button>
        <button class="btn" id="btn-next-question" disabled>Siguiente →</button>
      </div>
    </div>
  `);

  // Seleccionar opción
  document.querySelectorAll(".option-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".option-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      
      const val = (card as HTMLElement).dataset.val || "";
      wizard.answers[q.id] = val;
      
      setTimeout(() => {
        advanceQuestion();
      }, 300);
    });
  });

  const nextBtn = document.getElementById("btn-next-question") as HTMLButtonElement;
  if (wizard.answers[q.id]) {
    nextBtn.disabled = false;
  }

  document.getElementById("btn-prev-question")!.addEventListener("click", () => {
    if (wizard.current_question_index > 0) {
      wizard.current_question_index--;
      renderWizardStep2();
    }
  });

  nextBtn.addEventListener("click", () => {
    advanceQuestion();
  });

  function advanceQuestion() {
    if (wizard.current_question_index < total - 1) {
      wizard.current_question_index++;
      renderWizardStep2();
    } else {
      wizard.step = 3;
      renderCreateAudit();
    }
  }
}

// Paso 3: Pantalla HUD de Carga en Vivo (Live Scan)
function renderWizardStep3(): void {
  shell(`
    <div class="scan-container">
      <div class="scan-radar"><span>🔍</span></div>
      <h1>Auditoría Digital en Proceso</h1>
      <p class="sub">Estamos analizando de forma automatizada los enlaces provistos y cruzando los resultados con el cuestionario de negocio.</p>
      
      <div class="scan-list">
        <div class="scan-item active" id="scan-ssl"><div class="dot"></div><span>Analizando certificado SSL e integridad HTTPS...</span></div>
        <div class="scan-item pending" id="scan-mobile"><div class="dot"></div><span>Evaluando compatibilidad móvil y adaptabilidad...</span></div>
        <div class="scan-item pending" id="scan-pixels"><div class="dot"></div><span>Escaneando tags de GA4, Google Tag Manager y Meta Pixel...</span></div>
        <div class="scan-item pending" id="scan-conversion"><div class="dot"></div><span>Buscando botones de WhatsApp y formularios de conversión...</span></div>
        <div class="scan-item pending" id="scan-social"><div class="dot"></div><span>Validando redes sociales y consistencia de marca...</span></div>
        <div class="scan-item pending" id="scan-report"><div class="dot"></div><span>Calculando simulador financiero e integrando reporte ejecutivo...</span></div>
      </div>
    </div>
  `);

  runLiveScan();
}

async function runLiveScan(): Promise<void> {
  const steps = ["ssl", "mobile", "pixels", "conversion", "social", "report"];
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const apiCallPromise = api<{ id: string }>("/api/diagnostics/start", {
    method: "POST",
    body: JSON.stringify({
      business_name: wizard.business_name,
      website_url: wizard.website_url,
      niche: wizard.niche,
      size: wizard.size,
    }),
  });

  try {
    const startResult = await apiCallPromise;
    const auditId = startResult.id;

    for (let i = 0; i < steps.length; i++) {
      const current = document.getElementById(`scan-${steps[i]}`)!;
      current.className = "scan-item active";
      await delay(650);

      current.className = "scan-item done";
      if (i < steps.length - 1) {
        const next = document.getElementById(`scan-${steps[i + 1]}`)!;
        next.className = "scan-item active";
      }
    }

    const resultReport = await api<{ id: string }>(`/api/diagnostics/${auditId}/survey`, {
      method: "POST",
      body: JSON.stringify({
        answers: wizard.answers,
      }),
    });

    toast("¡Diagnóstico generado con éxito y enviado por correo!");
    selectedAuditId = resultReport.id;
    currentView = "audit_report";
    render();
  } catch (err) {
    console.error(err);
    toast("Ocurrió un error al procesar el diagnóstico.");
    currentView = "dashboard";
    render();
  }
}

// ── VISTA 3: Reporte Ejecutivo VIP (PulseAudit Report) ─────────────────────

async function renderAuditReport(): Promise<void> {
  if (!selectedAuditId) {
    currentView = "dashboard";
    return render();
  }

  shell(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
      <button class="btn secondary btn-sm" id="btn-back-report">← Volver a Diagnósticos</button>
      <button class="btn btn-sm" id="btn-print-report">🖨️ Guardar PDF / Imprimir</button>
    </div>
    <h1>Cargando reporte ejecutivo...</h1>
  `);

  try {
    const res = await api<any>(`/api/diagnostics/${selectedAuditId}`);
    
    // Extracción robusta de propiedades planas para resolver el Bug de Carga
    const businessName = res.business_name;
    const websiteUrl = res.website_url;
    const nicheCode = res.niche;
    const sizeCode = res.size;
    const answers = res.survey || {}; // answers se lee desde survey_json
    const r = res.report;
    const scores = r.scores;

    // Calcular el Badge de Calificación B2B
    let b2bLevel = "medium";
    let b2bTitle = "Candidato en Crecimiento (Aptitud Media)";
    let b2bDesc = "Tu negocio tiene una base técnica, pero el pilar de ventas y operaciones es manual. Te beneficiarías enormemente de una sesión estratégica para automatizar tareas repetitivas.";
    let b2bCTA = "Agendar Auditoría Estratégica Gratuita";

    const manualOps = answers.operations_coordination === "manual";
    const slowResponse = answers.response_time === "day_or_two" || answers.response_time === "more_than_48";

    if (manualOps || (slowResponse && sizeCode !== "solo")) {
      b2bLevel = "high";
      b2bTitle = "Excelente Candidato (Apto - Prioridad Alta)";
      b2bDesc = "Tu negocio cuenta con la escala y fricciones operativas ideales para beneficiarse de una **solución web o app personalizada**. Un desarrollo a medida puede automatizar tu gestión de tareas y acelerar tu tiempo de respuesta comercial a minutos, eliminando fugas de dinero inmediatamente.";
      b2bCTA = "Agendar Consultoría de Desarrollo a Medida (Gratis)";
    } else if (sizeCode === "solo") {
      b2bLevel = "low";
      b2bTitle = "Fase Inicial (Aptitud de Software Baja)";
      b2bDesc = "Dado tu tamaño actual, te recomendamos iniciar implementando plantillas autogestionables y herramientas no-code básicas. Aún no requieres un desarrollo a medida robusto. Puedes descargar nuestros recursos gratuitos.";
      b2bCTA = "Descargar Recursos de Apoyo Gratuito";
    }

    const b2bBadgeClass = b2bLevel === "high" ? "high" : b2bLevel === "medium" ? "medium" : "low";

    const breakdownPills = `
      <div class="gauge-pill">
        <div class="gauge-pill-header"><span>Cimientos Web</span><span>${scores.web_foundation}%</span></div>
        <div class="gauge-pill-bar"><div class="gauge-pill-fill" style="width: ${scores.web_foundation}%; background: var(--accent-2)"></div></div>
      </div>
      <div class="gauge-pill">
        <div class="gauge-pill-header"><span>Posicionamiento SEO</span><span>${scores.seo}%</span></div>
        <div class="gauge-pill-bar"><div class="gauge-pill-fill" style="width: ${scores.seo}%; background: var(--accent)"></div></div>
      </div>
      <div class="gauge-pill">
        <div class="gauge-pill-header"><span>Medición & Tracking</span><span>${scores.tracking}%</span></div>
        <div class="gauge-pill-bar"><div class="gauge-pill-fill" style="width: ${scores.tracking}%; background: var(--success)"></div></div>
      </div>
      <div class="gauge-pill">
        <div class="gauge-pill-header"><span>Canales de Conversión</span><span>${scores.conversion}%</span></div>
        <div class="gauge-pill-bar"><div class="gauge-pill-fill" style="width: ${scores.conversion}%; background: var(--warn)"></div></div>
      </div>
      <div class="gauge-pill">
        <div class="gauge-pill-header"><span>Presencia Redes</span><span>${scores.social_presence}%</span></div>
        <div class="gauge-pill-bar"><div class="gauge-pill-fill" style="width: ${scores.social_presence}%; background: var(--danger)"></div></div>
      </div>
    `;

    const findingsRows = r.findings.map((f) => {
      const areaText: Record<string, string> = {
        web: "💻 Web",
        seo: "🔍 SEO",
        tracking: "📊 Tracking",
        conversion: "🛒 Conversión",
        social: "📱 Redes",
        negocio: "🏢 Negocio",
      };

      const severityBadge =
        f.severity === "good"
          ? `<span class="badge good">Excelente</span>`
          : f.severity === "warn"
          ? `<span class="badge warn">Advertencia</span>`
          : `<span class="badge bad">Crítico</span>`;

      return `
        <tr>
          <td><strong style="font-family:var(--display)">${areaText[f.area] || f.area}</strong></td>
          <td>${severityBadge}</td>
          <td><strong>${f.title}</strong><br/><span style="color:var(--muted); font-size:0.8rem">${f.detail}</span></td>
        </tr>
      `;
    }).join("");

    const solutionsHtml = r.solution_system.map((s, idx) => `
      <div class="solution-item ${idx === 0 ? "open" : ""}" data-idx="${idx}">
        <div class="solution-header">
          <div class="solution-title-box">
            <span class="badge ${s.impact === "alto" ? "good" : "warn"}">${s.impact.toUpperCase()} IMPACTO</span>
            <h3>${s.title}</h3>
          </div>
          <span class="arrow">▼</span>
        </div>
        <div class="solution-content">
          <div class="solution-why"><strong>¿Por qué esto limita tu negocio?</strong><br/>${s.why}</div>
          <h4 style="font-size:0.85rem; color:var(--accent-2); margin-bottom:0.5rem; font-family:var(--display)">Pasos recomendados para la implementación:</h4>
          <ul class="solution-steps">
            ${s.steps.map((st) => `<li>${st}</li>`).join("")}
          </ul>
        </div>
      </div>
    `).join("");

    const bonusesHtml = r.bonuses.map((b) => `
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:1rem">
        <div>
          <span style="font-size:1.5rem">🎁</span>
          <h3 style="margin-top:0.5rem; margin-bottom:0.25rem">${b.title}</h3>
          <p style="font-size:0.78rem; color:var(--muted); line-height:1.5">${b.description}</p>
        </div>
        <button class="btn secondary btn-sm btn-claim-bonus" data-title="${b.title}" style="align-self:flex-start">Acceder Recurso</button>
      </div>
    `).join("");

    shell(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
        <button class="btn secondary btn-sm" id="btn-back-report">← Volver a Diagnósticos</button>
        <button class="btn btn-sm" id="btn-print-report">🖨️ Guardar PDF / Imprimir</button>
      </div>

      <!-- BANNER DE CUALIFICACIÓN B2B -->
      <div class="b2b-banner">
        <div class="b2b-content">
          <div class="b2b-text">
            <span class="b2b-badge ${b2bBadgeClass}">${b2bTitle}</span>
            <h2>Análisis de Viabilidad Tecnológica</h2>
            <p>${b2bDesc}</p>
          </div>
          <button class="btn" id="btn-b2b-cta" style="flex-shrink:0">${b2bCTA}</button>
        </div>
      </div>

      <!-- HEADER DEL REPORTE -->
      <div style="margin-bottom:2rem">
        <h1 style="font-size:2.5rem">${businessName}</h1>
        <p class="sub" style="margin-bottom:0.5rem">${r.niche_label} · ${r.size_label}</p>
        <p style="font-size:0.9rem; color:var(--muted)">Sitio Web: <a href="${websiteUrl}" target="_blank" style="color:var(--accent-2); text-decoration:none">${websiteUrl}</a></p>
      </div>

      <!-- SCORES E INDICADORES -->
      <div class="panel">
        <h2>Puntaje General de Salud Técnica</h2>
        <div class="gauge-container">
          <div class="gauge-circle" style="--pct: ${scores.overall}%">
            <div class="gauge-inner">
              <div class="gauge-num">${scores.overall}</div>
              <div class="gauge-label">Score Global</div>
            </div>
          </div>
          <div class="gauge-breakdown">${breakdownPills}</div>
        </div>
      </div>

      <!-- SÍNTESIS ESTRATÉGICA EN PROSA -->
      <div class="panel">
        <h2>Resumen Ejecutivo de Negocios</h2>
        <p style="line-height:1.75; font-size:1rem; color:var(--text); font-style:italic; border-left:4px solid var(--accent); padding-left:1.25rem">
          "${r.executive_summary}"
        </p>
      </div>

      <!-- SIMULADOR FINANCIERO INTERACTIVO -->
      <div class="panel">
        <h2>Simulador Financiero de Retorno (ROI)</h2>
        <p class="sub" style="margin-bottom:1.5rem">Ajusta los sliders para proyectar el impacto económico de optimizar tu embudo y velocidad web.</p>
        
        <div class="simulator-layout">
          <div class="sim-control-panel">
            <div class="sim-slider-group">
              <div class="sim-slider-header"><span>Visitas Web Mensuales</span><span class="val" id="val-sim-visits">10,000</span></div>
              <input type="range" id="sim-visits" min="500" max="50000" step="500" value="10000" />
            </div>
            
            <div class="sim-slider-group">
              <div class="sim-slider-header"><span>Conversión Visita → Lead (%)</span><span class="val" id="val-sim-conv">2.0%</span></div>
              <input type="range" id="sim-conv" min="0.2" max="10.0" step="0.1" value="2.0" />
            </div>
            
            <div class="sim-slider-group">
              <div class="sim-slider-header"><span>Tasa de Cierre Comercial (%)</span><span class="val" id="val-sim-close">15%</span></div>
              <input type="range" id="sim-close" min="1" max="50" step="1" value="15" />
            </div>
            
            <div class="sim-slider-group">
              <div class="sim-slider-header"><span>Valor del Ticket Promedio (AOV)</span><span class="val" id="val-sim-aov">USD 150</span></div>
              <input type="range" id="sim-aov" min="10" max="2500" step="10" value="150" />
            </div>
            
            <div class="sim-slider-group">
              <div class="sim-slider-header"><span>Inversión Mensual en Ads</span><span class="val" id="val-sim-spend">USD 500</span></div>
              <input type="range" id="sim-spend" min="0" max="10000" step="100" value="500" />
            </div>
          </div>
          
          <div class="sim-results">
            <div class="sim-result-card"><span class="lbl">Leads / mes</span><span class="val" id="res-sim-leads">200</span></div>
            <div class="sim-result-card"><span class="lbl">Clientes / mes</span><span class="val" id="res-sim-clients">30</span></div>
            <div class="sim-result-card" style="grid-column: span 2; background: linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(99,102,241,0.1) 100%)">
              <span class="lbl">Ingreso Proyectado / mes</span><span class="val" id="res-sim-revenue" style="color:var(--accent-2)">USD 4,500</span>
            </div>
            <div class="sim-result-card"><span class="lbl">Costo por Lead (CPL)</span><span class="val" id="res-sim-cpl">USD 2.50</span></div>
            <div class="sim-result-card"><span class="lbl">ROAS Estimado</span><span class="val" id="res-sim-roas">9.0x</span></div>
          </div>
        </div>

        <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius:var(--radius-sm); padding:1rem; margin-top:1.5rem; display:flex; align-items:center; gap:0.75rem">
          <span style="font-size:1.5rem">⚡</span>
          <p style="font-size:0.82rem; color:var(--muted); line-height:1.5">
            <strong>Efecto del Desarrollo a Medida:</strong> Al rediseñar y automatizar tu proceso web, si tu conversión subiera un humilde <strong>1.5% extra</strong>, tus ingresos aumentarían automáticamente a <strong id="res-sim-boost" style="color:var(--success)">USD 7,875</strong> con la misma cantidad de visitas e inversión.
          </p>
        </div>
      </div>

      <!-- DETALLE DE HALLAZGOS (TÉCNICOS Y ESTRATÉGICOS) -->
      <div class="panel" style="overflow-x:auto">
        <h2>Detalle de Diagnóstico & Hallazgos</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 130px">Pilar</th>
              <th style="width: 120px">Estado</th>
              <th>Hallazgo Detectado</th>
            </tr>
          </thead>
          <tbody>${findingsRows}</tbody>
        </table>
      </div>

      <!-- HOJA DE RUTA PRIORIZADA -->
      <div style="margin-top:2.5rem; margin-bottom:1.5rem">
        <h2>Plan de Acción & Hoja de Ruta</h2>
        <p class="sub">Tareas priorizadas según nivel de impacto para tu negocio.</p>
        <div id="solutions-container">${solutionsHtml}</div>
      </div>

      <!-- SECCIÓN DE BONOS -->
      <div style="margin-top:2.5rem; margin-bottom:3rem">
        <h2>Recursos Estratégicos Adicionales (Bonos Gratuitos)</h2>
        <p class="sub">Plantillas y manuales adaptados para acelerar la implementación en tu nicho.</p>
        <div class="cards" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))">${bonusesHtml}</div>
      </div>

      <!-- MODAL DE AGENDAMIENTO VIRTUAL -->
      <div id="cta-modal" class="toast hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; gap:1.25rem; width:92%; max-width:420px; background:var(--surface-2); border:1px solid var(--accent); padding:2rem; box-shadow:0 20px 80px rgba(0,0,0,0.6)">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <h3 style="font-size:1.25rem; font-family:var(--display)">Agenda tu Sesión Estratégica</h3>
          <button id="btn-close-modal" style="background:transparent; border:none; color:var(--muted); font-size:1.2rem; cursor:pointer">×</button>
        </div>
        <p style="font-size:0.85rem; color:var(--muted); line-height:1.5">Conéctate para co-diseñar tu embudo técnico y recibir una cotización detallada de soluciones a medida.</p>
        <form id="form-cta-modal" style="display:flex; flex-direction:column; gap:0.85rem">
          <input type="text" placeholder="Tu Nombre Completo" required />
          <input type="email" placeholder="Tu Email" required />
          <input type="tel" placeholder="Tu WhatsApp (con código de país)" required />
          <button type="submit" class="btn" style="width:100%; justify-content:center">Confirmar Agendamiento</button>
        </form>
      </div>
    `);

    // Listeners del Reporte
    document.getElementById("btn-back-report")!.addEventListener("click", () => {
      currentView = "dashboard";
      render();
    });

    document.getElementById("btn-print-report")!.addEventListener("click", () => {
      window.print();
    });

    // Control de Accordions de Soluciones
    document.querySelectorAll(".solution-header").forEach((header) => {
      header.addEventListener("click", () => {
        const item = header.closest(".solution-item")!;
        const wasOpen = item.classList.contains("open");
        
        document.querySelectorAll(".solution-item").forEach((it) => it.classList.remove("open"));
        
        if (!wasOpen) {
          item.classList.add("open");
        }
      });
    });

    // Simulador Financiero en Tiempo Real
    const simVisits = document.getElementById("sim-visits") as HTMLInputElement;
    const simConv = document.getElementById("sim-conv") as HTMLInputElement;
    const simClose = document.getElementById("sim-close") as HTMLInputElement;
    const simAov = document.getElementById("sim-aov") as HTMLInputElement;
    const simSpend = document.getElementById("sim-spend") as HTMLInputElement;

    const valVisits = document.getElementById("val-sim-visits")!;
    const valConv = document.getElementById("val-sim-conv")!;
    const valClose = document.getElementById("val-sim-close")!;
    const valAov = document.getElementById("val-sim-aov")!;
    const valSpend = document.getElementById("val-sim-spend")!;

    const resLeads = document.getElementById("res-sim-leads")!;
    const resClients = document.getElementById("res-sim-clients")!;
    const resRevenue = document.getElementById("res-sim-revenue")!;
    const resCpl = document.getElementById("res-sim-cpl")!;
    const resRoas = document.getElementById("res-sim-roas")!;
    const resBoost = document.getElementById("res-sim-boost")!;

    function recalculateSimulator() {
      const visits = Number(simVisits.value);
      const conv = Number(simConv.value);
      const close = Number(simClose.value);
      const aov = Number(simAov.value);
      const spend = Number(simSpend.value);

      valVisits.textContent = visits.toLocaleString();
      valConv.textContent = conv.toFixed(1) + "%";
      valClose.textContent = close + "%";
      valAov.textContent = "USD " + aov.toLocaleString();
      valSpend.textContent = "USD " + spend.toLocaleString();

      const leads = Math.round((visits * conv) / 100);
      const clients = Math.round((leads * close) / 100);
      const revenue = clients * aov;
      
      const cpl = spend > 0 && leads > 0 ? spend / leads : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      const boostLeads = Math.round((visits * (conv + 1.5)) / 100);
      const boostClients = Math.round((boostLeads * close) / 100);
      const boostRevenue = boostClients * aov;

      resLeads.textContent = leads.toLocaleString();
      resClients.textContent = clients.toLocaleString();
      resRevenue.textContent = "USD " + revenue.toLocaleString();
      resCpl.textContent = cpl > 0 ? "USD " + cpl.toFixed(2) : "—";
      resRoas.textContent = roas > 0 ? roas.toFixed(1) + "x" : "—";
      resBoost.textContent = "USD " + boostRevenue.toLocaleString();
    }

    [simVisits, simConv, simClose, simAov, simSpend].forEach((slider) => {
      slider.addEventListener("input", recalculateSimulator);
    });

    recalculateSimulator();

    // Modal de CTA / Agendamiento
    const btnCTA = document.getElementById("btn-b2b-cta")!;
    const modal = document.getElementById("cta-modal")!;
    const btnCloseModal = document.getElementById("btn-close-modal")!;

    btnCTA.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });

    btnCloseModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    document.getElementById("form-cta-modal")!.addEventListener("submit", (e) => {
      e.preventDefault();
      modal.classList.add("hidden");
      toast("🚀 ¡Llamada agendada! Te contactaremos a la brevedad.");
    });

    document.querySelectorAll(".btn-claim-bonus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const title = (btn as HTMLElement).dataset.title;
        toast(`📥 Descargando recurso: ${title}`);
      });
    });

  } catch (err) {
    console.error(err);
    toast("Error al cargar el reporte ejecutivo.");
    currentView = "dashboard";
    render();
  }
}

// Iniciar aplicación SPA
render();
