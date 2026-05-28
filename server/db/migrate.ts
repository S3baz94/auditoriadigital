import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function migrate(): void {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  migrate();
  console.log("Database migrated.");
}
