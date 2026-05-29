import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diagnosticsRouter } from "./routes/diagnostics.js";

export function createApp(): express.Express {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "Diagnóstico Digital", version: "2.0.0" });
  });

  app.use("/api/diagnostics", diagnosticsRouter);

  // Servir SPA (local). En Vercel se sirve vía routes en vercel.json.
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
