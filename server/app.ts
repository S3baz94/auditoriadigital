import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditsRouter } from "./routes/audits.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { leadsRouter } from "./routes/leads.js";
import { statsRouter } from "./routes/stats.js";
import { trackRouter } from "./routes/track.js";

export function createApp(): express.Express {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "LeadPulse", version: "1.0.0" });
  });

  app.use("/api/leads", leadsRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/track", trackRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/audits", auditsRouter);

  // In Vercel we serve the SPA with rewrites in vercel.json
  // Local/prod self-host: serve built client from /dist
  const distClient = path.join(__dirname, "../dist");
  app.use(express.static(distClient));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distClient, "index.html"), (err) => {
      if (err) next();
    });
  });

  return app;
}

