import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./app";
import { createDatabase } from "./db";

dotenv.config({ path: resolve(__dirname, "../../.env") });
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
const clientOrigin = process.env.CLIENT_ORIGIN;
if (!clientOrigin) {
  throw new Error("CLIENT_ORIGIN must be configured");
}

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/omni-client-system.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const database = createDatabase(databasePath);
const port = Number(process.env.PORT ?? 4000);
const server = createApp(database, jwtSecret, clientOrigin).listen(port, () => {
  console.log(`Omni Client System API listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown(error?: Error) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (error) console.error(JSON.stringify({ level: "fatal", message: error.message, stack: error.stack }));

  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    database.close();
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close((closeError) => {
    clearTimeout(timeout);
    if (closeError) console.error(closeError);
    database.close();
    process.exit(error || closeError ? 1 : 0);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ level: "error", message: "Unhandled promise rejection", reason }));
});
process.once("uncaughtException", (error) => shutdown(error));
process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());
