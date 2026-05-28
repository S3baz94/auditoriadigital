import { closeDb } from "./db/index.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3847;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`LeadPulse API http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  server.close();
  closeDb();
  process.exit(0);
});

export { app };
