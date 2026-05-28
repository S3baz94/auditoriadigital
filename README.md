# LeadPulse

Plataforma **autohospedada** con el flujo funcional de [MailerFind](https://mailerfind.com/):

| Función MailerFind | LeadPulse |
|--------------------|-----------|
| Extraer leads (seguidores, hashtag, likers…) | ✅ Modo demo + importación CSV |
| NameAI (nombres desde username) | ✅ |
| Verificación de email | ✅ Sintaxis + MX |
| Filtros / segmentación | ✅ API + UI |
| Export CSV | ✅ |
| Export Meta Custom Audience | ✅ |
| Email sender (SMTP) | ✅ Gmail, Outlook, SendGrid… |
| Tracking aperturas | ✅ Pixel |
| Unsubscribe | ✅ |
| Scraping IG sin login (infra propia) | ❌ No incluido — viola ToS de Meta/IG |

## Requisitos

- Node.js 20+
- Windows / macOS / Linux

## Instalación

```bash
cd leadpulse
npm install
npm run dev
```

- **UI:** http://localhost:5173  
- **API:** http://localhost:3847  

## Uso rápido

1. **Extraer leads** → tipo “Seguidores”, cuenta `@competidor`, Escanear (datos demo).
2. O **Importar** `data/sample-leads.csv`.
3. **NameAI** y **Verificar emails**.
4. **SMTP** → conectar Gmail (app password) u otro proveedor.
5. **Campañas** → crear, Encolar, Enviar.

## Producción

```bash
npm run build
npm start
```

Sirve UI + API en el puerto `3847`.

## Deploy en Vercel (link en 2 minutos)

Este repo se puede desplegar en Vercel como:
- **Frontend**: build estático (`dist`)
- **Backend**: función serverless (`/api/index.ts`)

Notas importantes:
- **SQLite en Vercel es efímero** (se guarda en `/tmp`): la data puede reiniciarse en cold starts. Para producción real, migraremos a Postgres/Neon o Vercel Postgres.

### Opción A: Deploy con un click (recomendado)

1. Sube este repo a GitHub.
2. En Vercel: **New Project** → Importa el repo → Deploy.
3. Abre el link de Vercel.

### Opción B: Deploy con Vercel CLI

```bash
npm i -g vercel
vercel
```

El primer deploy te dará una URL de preview.

## Legal

- Usa solo **datos públicos** con base legal (GDPR, CAN-SPAM, LFPDPPP según tu mercado).
- Incluye enlace de baja en cada campaña.
- No uses para spam; respeta límites SMTP y warm-up.

## Tests

```bash
npm test
```
