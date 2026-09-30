import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const schemaPath = resolve(__dirname, "../schema.sql");
const migrationsPath = resolve(__dirname, "../migrations");

export function applyMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = database.prepare("SELECT name FROM schema_migrations").all() as Array<{ name: string }>;
  const appliedNames = new Set(applied.map((row) => row.name));

  for (const name of readdirSync(migrationsPath).filter((file) => file.endsWith(".sql")).sort()) {
    if (appliedNames.has(name)) continue;

    const migration = readFileSync(resolve(migrationsPath, name), "utf8");
    const requestColumns = database.prepare("PRAGMA table_info(requests)").all() as Array<{ name: string }>;
    const userColumns = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasPriority = requestColumns.some((column) => column.name === "priority");
    const hasContactAndRole = ["customer_phone", "customer_email", "customer_city"].every((column) =>
      requestColumns.some((requestColumn) => requestColumn.name === column),
    ) && userColumns.some((column) => column.name === "role");
    const apply = database.transaction(() => {
      const alreadyInSchema =
        (name === "001_add_request_priority.sql" && hasPriority) ||
        (name === "002_add_contact_and_user_role.sql" && hasContactAndRole);
      if (!alreadyInSchema) {
        database.exec(migration);
      }
      database.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    });
    apply();
  }
}

export function createDatabase(path: string): Database.Database {
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.exec(readFileSync(schemaPath, "utf8"));
  applyMigrations(database);
  return database;
}
