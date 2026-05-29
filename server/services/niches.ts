// Taxonomía de nichos, tamaños y banco de preguntas de diagnóstico de negocio
// para el motor de diagnóstico digital PulseAudit.

export type SizeCode = "solo" | "micro" | "pequena" | "mediana";

export type NicheCode =
  | "restaurante"
  | "salud"
  | "retail"
  | "ecommerce"
  | "servicios_profesionales"
  | "educacion"
  | "inmobiliario"
  | "fitness"
  | "belleza"
  | "agencia"
  | "turismo"
  | "automotriz"
  | "construccion"
  | "tecnologia"
  | "otro";

export interface NicheDef {
  code: NicheCode;
  label: string;
  emoji: string;
  description: string;
}

export interface SizeDef {
  code: SizeCode;
  label: string;
  description: string;
}

export const NICHES: NicheDef[] = [
  { code: "restaurante", label: "Restaurante / Cafetería / Bar", emoji: "🍽️", description: "Comida, bebida, experiencia gastronómica" },
  { code: "salud", label: "Salud / Consultorio / Clínica", emoji: "⚕️", description: "Médicos, dentistas, terapias, psicólogos" },
  { code: "retail", label: "Tienda física / Comercio local", emoji: "🏪", description: "Venta en local físico" },
  { code: "ecommerce", label: "E-commerce / Tienda online", emoji: "🛒", description: "Venta de productos por internet" },
  { code: "servicios_profesionales", label: "Servicios profesionales / Consultoría", emoji: "💼", description: "Abogados, contadores, consultores, coaches" },
  { code: "educacion", label: "Educación / Cursos / Academia", emoji: "🎓", description: "Formación, cursos, capacitación" },
  { code: "inmobiliario", label: "Inmobiliaria / Real estate", emoji: "🏠", description: "Compra, venta, alquiler de propiedades" },
  { code: "fitness", label: "Fitness / Gimnasio / Entrenamiento", emoji: "💪", description: "Gimnasios, entrenadores, yoga, deportes" },
  { code: "belleza", label: "Belleza / Estética / Spa", emoji: "💇", description: "Peluquería, estética, spa, uñas" },
  { code: "agencia", label: "Agencia / Estudio creativo", emoji: "🎨", description: "Marketing, diseño, software, contenido" },
  { code: "turismo", label: "Turismo / Hotel / Viajes", emoji: "✈️", description: "Hoteles, agencias, experiencias" },
  { code: "automotriz", label: "Automotriz / Taller / Concesionaria", emoji: "🚗", description: "Vehículos, talleres, lavados, repuestos" },
  { code: "construccion", label: "Construcción / Reformas", emoji: "🔨", description: "Constructoras, arquitectos, remodelaciones" },
  { code: "tecnologia", label: "Tecnología / SaaS / Software", emoji: "💻", description: "Software, apps, servicios IT" },
  { code: "otro", label: "Otro tipo de negocio", emoji: "🏢", description: "Otro rubro" },
];

export const SIZES: SizeDef[] = [
  { code: "solo", label: "Emprendimiento individual", description: "Solo yo (sin empleados)" },
  { code: "micro", label: "Microempresa", description: "2 a 10 personas" },
  { code: "pequena", label: "Pequeña empresa", description: "11 a 50 personas" },
  { code: "mediana", label: "Mediana o grande", description: "Más de 50 personas" },
];

export type QuestionType = "single" | "multi" | "text";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  helper?: string;
  options?: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  {
    id: "goal_6m",
    type: "single",
    question: "¿Cuál es tu enfoque prioritario para los próximos 6 meses?",
    helper: "Define la meta estratégica principal de tu negocio.",
    options: [
      { value: "more_clients", label: "Conseguir nuevos clientes o expandir mercado" },
      { value: "more_revenue", label: "Aumentar el ticket promedio de compra o ventas" },
      { value: "retention", label: "Fidelizar y hacer que los clientes actuales recompren" },
      { value: "automate", label: "Automatizar procesos internos para ahorrar tiempo y costos" },
    ],
  },
  {
    id: "revenue_stability",
    type: "single",
    question: "¿Cómo calificarías la estabilidad de tus ingresos actuales?",
    options: [
      { value: "highly_variable", label: "Muy variable e impredecible mes a mes" },
      { value: "stable_flat", label: "Estable, pero plano y sin crecimiento" },
      { value: "growing", label: "Crecimiento constante y predecible" },
    ],
  },
  {
    id: "acquisition_channel",
    type: "single",
    question: "¿Cuál es tu principal canal para atraer nuevos clientes hoy?",
    options: [
      { value: "referrals", label: "Recomendaciones de clientes existentes (boca a boca)" },
      { value: "paid_ads", label: "Publicidad digital de pago (Facebook, Instagram, Google)" },
      { value: "organic_social", label: "Redes sociales de manera orgánica (sin pagar publicidad)" },
      { value: "outbound", label: "Prospección directa o ventas frías (llamadas, visitas)" },
    ],
  },
  {
    id: "referral_frequency",
    type: "single",
    question: "¿Con qué frecuencia tus clientes actuales recomiendan tu negocio de forma activa?",
    options: [
      { value: "always", label: "Constantemente, el boca a boca es nuestro motor principal" },
      { value: "sometimes", label: "Ocasionalmente, solo si alguien les pregunta de forma directa" },
      { value: "never", label: "Rara vez o nunca nos recomiendan de forma activa" },
    ],
  },
  {
    id: "response_time",
    type: "single",
    question: "¿Cuánto tiempo pasa en promedio desde que un cliente potencial te contacta hasta que recibe respuesta o cotización?",
    options: [
      { value: "minutes", label: "Minutos (atención casi inmediata)" },
      { value: "hours", label: "Unas pocas horas" },
      { value: "day_or_two", label: "De 24 a 48 horas" },
      { value: "more_than_48", label: "Más de 48 horas" },
    ],
  },
  {
    id: "sales_followup",
    type: "single",
    question: "¿Cómo manejas el seguimiento de las propuestas o cotizaciones enviadas?",
    options: [
      { value: "crm", label: "Usamos un CRM estructurado para registrar y dar seguimiento" },
      { value: "manual", label: "De forma manual, agendando recordatorios o por correo directo" },
      { value: "none", label: "No realizamos un seguimiento sistemático" },
    ],
  },
  {
    id: "operations_coordination",
    type: "single",
    question: "¿Cómo gestionas las tareas y la coordinación del día a día con tu equipo?",
    options: [
      { value: "automated", label: "Totalmente automatizado con software de gestión de proyectos dedicado" },
      { value: "basic_tools", label: "Herramientas básicas como chats de WhatsApp o tableros de Trello" },
      { value: "manual", label: "Procesos manuales apoyados en papel, libretas o tablas de Excel" },
    ],
  },
  {
    id: "pricing_strategy",
    type: "single",
    question: "¿Cómo defines los precios de tus productos o servicios?",
    options: [
      { value: "premium", label: "Precios premium basados en el valor que percibe el cliente" },
      { value: "cost_plus", label: "Margen fijo sumado sobre nuestros costos estimados" },
      { value: "market", label: "Alineados con el mercado para competir por precio con la competencia" },
      { value: "unclear", label: "No tengo una estrategia de precios estructurada" },
    ],
  },
  {
    id: "tech_satisfaction",
    type: "single",
    question: "¿Qué tan satisfecho estás con las herramientas tecnológicas actuales de tu negocio?",
    options: [
      { value: "very_satisfied", label: "Muy satisfecho, todo funciona integrado y rápido" },
      { value: "partially_satisfied", label: "Parcialmente satisfecho, algunas herramientas nos limitan o están aisladas" },
      { value: "unsatisfied", label: "Insatisfecho, la tecnología nos genera más fricción y problemas" },
    ],
  },
];

export function getSurvey(_niche: NicheCode, _size: SizeCode): Question[] {
  // Retorna las 9 preguntas unificadas de diagnóstico general
  return QUESTIONS;
}

export function findNiche(code: string): NicheDef | undefined {
  return NICHES.find((n) => n.code === code);
}

export function findSize(code: string): SizeDef | undefined {
  return SIZES.find((s) => s.code === code);
}
