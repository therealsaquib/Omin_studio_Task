import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { applyMigrations, createDatabase } from "../src/db";

const secret = "omni-client-system-test-secret-32chars";
const clientOrigin = "http://localhost:5173";
const demoPassword = "Demo@1234";
let database: Database.Database;
let app: ReturnType<typeof createApp>;
let tokenPune: string;
let tokenChennai: string;

beforeEach(() => {
  database = createDatabase(":memory:");
  database.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?), (?, ?)").run(
    "workspace-pune", "Pune Home Services", "workspace-chennai", "Chennai Beauty & Wellness",
  );
  const passwordHash = bcrypt.hashSync(demoPassword, 10);
  database.prepare(
    "INSERT INTO users (id, workspace_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, 'ADMIN'), (?, ?, ?, ?, ?, 'ADMIN')",
  ).run(
    "user-saqib", "workspace-pune", "saqib@omni.example", passwordHash, "Saqib",
    "user-ananya", "workspace-chennai", "ananya@chennaibeauty.example", passwordHash, "Ananya Iyer",
  );
  database.prepare(
    `INSERT INTO requests
     (id, workspace_id, customer_name, customer_phone, customer_email, customer_city,
      service, scheduled_date, priority, status, created_at, updated_at)
     VALUES
     ('1', 'workspace-pune', 'Priya Nair', '+91 98220 10001', 'priya.nair@omni.example', 'Pune', 'AC servicing', '2026-10-02', 'URGENT', 'QUALIFIED', '2026-09-25T10:00:00.000Z', '2026-09-26T10:00:00.000Z'),
     ('2', 'workspace-chennai', 'Kavita Reddy', '+91 98400 20001', 'kavita.reddy@omni.example', 'Chennai', 'Bridal makeup trial', '2026-10-02', 'URGENT', 'QUALIFIED', '2026-09-25T10:00:00.000Z', '2026-09-26T10:00:00.000Z'),
     ('3', 'workspace-pune', 'Amit Kulkarni', '+91 98220 10002', 'amit.kulkarni@omni.example', 'Pune', 'Plumbing leak repair', '2026-10-03', 'NORMAL', 'NEW', '2026-09-25T11:00:00.000Z', '2026-09-25T11:00:00.000Z')`,
  ).run();
  tokenPune = jwt.sign({ userId: "user-saqib", workspaceId: "workspace-pune", role: "ADMIN" }, secret);
  tokenChennai = jwt.sign({ userId: "user-ananya", workspaceId: "workspace-chennai", role: "ADMIN" }, secret);
  app = createApp(database, secret, clientOrigin);
});

afterEach(() => {
  database.close();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("workspace-scoped request API", () => {
  it("does not let Pune read, edit, or convert a Chennai request by ID", async () => {
    const getResponse = await request(app).get("/requests/2").set(auth(tokenPune));
    const patchResponse = await request(app).patch("/requests/2").set(auth(tokenPune)).send({ status: "CLOSED" });
    const convertResponse = await request(app).post("/requests/2/convert").set(auth(tokenPune));

    expect(getResponse.status).toBe(404);
    expect(getResponse.body.error.code).toBe("NOT_FOUND");
    expect(patchResponse.status).toBe(404);
    expect(convertResponse.status).toBe(404);
    expect(database.prepare("SELECT status FROM requests WHERE id = '2'").get()).toEqual({ status: "QUALIFIED" });
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 0 });
  });

  it("rejects non-numeric request IDs with a typed 400", async () => {
    const response = await request(app).get("/requests/abc").set(auth(tokenPune));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ID");
  });

  it("rejects converting a request that is not qualified", async () => {
    const response = await request(app).post("/requests/3/convert").set(auth(tokenPune));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_STATE");
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 0 });
  });

  it("converts a qualified request idempotently with one work item and activity", async () => {
    const first = await request(app).post("/requests/1/convert").set(auth(tokenPune));
    const second = await request(app).post("/requests/1/convert").set(auth(tokenPune));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.alreadyExists).toBe(true);
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items WHERE request_id = '1'").get()).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM activities WHERE request_id = '1' AND action = 'WORK_ITEM_CREATED'").get()).toEqual({ count: 1 });
  });

  it("validates priority and contact fields and rejects client workspace selectors", async () => {
    const response = await request(app).post("/requests").set(auth(tokenPune)).send({
      customer_name: "Neha Gupta",
      customer_phone: "+91 98220 10009",
      customer_email: "neha.gupta@omni.example",
      customer_city: "Pune",
      service: "Home cleaning",
      scheduled_date: "2026-10-11",
      priority: "ASAP",
      workspaceId: "workspace-chennai",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields.priority).toBeDefined();
    expect(response.body.error.fields.workspaceId).toBeDefined();
  });

  it("uses the database priority default when it is omitted", async () => {
    const response = await request(app).post("/requests").set(auth(tokenPune)).send({
      customer_name: "Neha Gupta",
      customer_phone: "+91 98220 10009",
      customer_email: "neha.gupta@omni.example",
      customer_city: "Pune",
      service: "Home cleaning",
      scheduled_date: "2026-10-11",
    });
    expect(response.status).toBe(201);
    expect(response.body.request.priority).toBe("NORMAL");
  });

  it("filters and paginates requests with scoped grouped counts", async () => {
    const response = await request(app)
      .get("/requests?status=QUALIFIED&priority=URGENT&page=1&pageSize=1&sort=scheduled_asc")
      .set(auth(tokenPune));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].customer_name).toBe("Priya Nair");
    expect(response.body.total).toBe(1);
    expect(response.body.counts).toEqual({ NEW: 1, QUALIFIED: 1, CLOSED: 0 });
    expect(response.body.pageSize).toBe(1);
  });

  it("caps list page size at 50 and applies search to customer and service", async () => {
    const oversized = await request(app).get("/requests?pageSize=51").set(auth(tokenPune));
    const search = await request(app).get("/requests?search=leak").set(auth(tokenPune));
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe("VALIDATION_ERROR");
    expect(search.body.total).toBe(1);
    expect(search.body.data[0].customer_name).toBe("Amit Kulkarni");
  });

  it("scopes overview, activities, and work items to the authenticated workspace", async () => {
    await request(app).post("/requests/1/convert").set(auth(tokenPune));
    const [puneOverview, chennaiOverview, puneActivities, chennaiWorkItems] = await Promise.all([
      request(app).get("/overview").set(auth(tokenPune)),
      request(app).get("/overview").set(auth(tokenChennai)),
      request(app).get("/activities?pageSize=50").set(auth(tokenPune)),
      request(app).get("/work-items").set(auth(tokenChennai)),
    ]);
    expect(puneOverview.body.counts).toEqual({ NEW: 1, QUALIFIED: 1, CLOSED: 0 });
    expect(puneOverview.body.workItems).toBe(1);
    expect(puneOverview.body.activity).toBe(1);
    expect(chennaiOverview.body.workItems).toBe(0);
    expect(puneActivities.body.data).toHaveLength(1);
    expect(chennaiWorkItems.body.data).toHaveLength(0);
    expect(chennaiWorkItems.body.total).toBe(0);
  });
});

describe("authentication and shared errors", () => {
  it("returns the same generic 401 message for unknown email and wrong password", async () => {
    const wrongPassword = await request(app).post("/auth/login").send({ email: "saqib@omni.example", password: "WrongPass123" });
    const unknownEmail = await request(app).post("/auth/login").send({ email: "nobody@omni.example", password: "WrongPass123" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe("Invalid email or password");
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
    expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code);
  });

  it("rejects malformed login input with per-field errors", async () => {
    const response = await request(app).post("/auth/login").send({ email: "not-an-email", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toHaveProperty("email");
    expect(response.body.error.fields).toHaveProperty("password");
  });

  it("limits the sixth failed login and sends Retry-After", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/auth/login").send({ email: "saqib@omni.example", password: "WrongPass123" });
      expect(response.status).toBe(401);
    }
    const limited = await request(app).post("/auth/login").send({ email: "saqib@omni.example", password: "WrongPass123" });
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("distinguishes missing, malformed, and expired tokens", async () => {
    const missing = await request(app).get("/requests");
    const malformed = await request(app).get("/requests").set("Authorization", "Bearer invalid");
    const expired = jwt.sign(
      { userId: "user-saqib", workspaceId: "workspace-pune", role: "ADMIN" },
      secret,
      { expiresIn: -1 },
    );
    const expiredResponse = await request(app).get("/requests").set(auth(expired));
    expect(missing.body.error.code).toBe("MISSING_TOKEN");
    expect(malformed.body.error.code).toBe("MALFORMED_TOKEN");
    expect(expiredResponse.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("returns workspace identity from login and /auth/me", async () => {
    const login = await request(app).post("/auth/login").send({ email: "SAQIB@OMNI.EXAMPLE", password: demoPassword });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({
      name: "Saqib",
      role: "ADMIN",
      workspaceName: "Pune Home Services",
    });
    expect(jwt.verify(login.body.token, secret)).toMatchObject({
      userId: "user-saqib",
      workspaceId: "workspace-pune",
      role: "ADMIN",
    });
    const me = await request(app).get("/auth/me").set(auth(login.body.token));
    expect(me.body.user.email).toBe("saqib@omni.example");
  });

  it("rechecks that a token's user still exists", async () => {
    database.prepare("DELETE FROM users WHERE id = 'user-saqib'").run();
    const response = await request(app).get("/requests").set(auth(tokenPune));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("returns JSON for malformed JSON and unknown routes", async () => {
    const malformed = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    const unknown = await request(app).get("/missing-route");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("MALFORMED_JSON");
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");
  });

  it("does not leak database or stack details from internal failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    database.exec("DROP TABLE activities");
    const response = await request(app).get("/requests/1").set(auth(tokenPune));
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toMatch(/stack|SQLITE|activities/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("serves health status and restricts CORS to the configured origin", async () => {
    const health = await request(app).get("/health");
    const cors = await request(app).get("/health").set("Origin", "https://untrusted.example");
    expect(health.body.status).toBe("ok");
    expect(cors.headers["access-control-allow-origin"]).toBe(clientOrigin);
  });
});

describe("database migrations", () => {
  it("adds constrained priority with a NORMAL default to an existing schema", () => {
    const legacy = new Database(":memory:");
    legacy.exec(`
      CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE users (id TEXT PRIMARY KEY, workspace_id TEXT, email TEXT, password_hash TEXT, name TEXT);
      CREATE TABLE requests (id TEXT PRIMARY KEY, workspace_id TEXT, customer_name TEXT, service TEXT, scheduled_date TEXT, status TEXT, created_at TEXT, updated_at TEXT);
      INSERT INTO workspaces VALUES ('workspace-pune', 'Pune Home Services');
      INSERT INTO users VALUES ('user-saqib', 'workspace-pune', 'saqib@omni.example', 'hash', 'Saqib');
      INSERT INTO requests VALUES ('1', 'workspace-pune', 'Priya Nair', 'AC servicing', '2026-10-02', 'NEW', 'now', 'now');
    `);
    applyMigrations(legacy);
    expect(legacy.prepare("SELECT priority FROM requests WHERE id = '1'").get()).toEqual({ priority: "NORMAL" });
    expect(() => legacy.prepare("UPDATE requests SET priority = 'ASAP' WHERE id = '1'").run()).toThrow();
    legacy.close();
  });
});
