import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createDatabase } from "./db";

dotenv.config({ path: resolve(__dirname, "../../.env") });
const demoPassword = process.env.DEMO_PASSWORD ?? "Demo@1234";
if (demoPassword.length < 8 || demoPassword.length > 72) {
  throw new Error("DEMO_PASSWORD must be between 8 and 72 characters");
}

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/omni-client-system.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const database = createDatabase(databasePath);

const workspaces = [
  {
    id: "workspace-pune",
    name: "Pune Home Services",
    userId: "user-saqib",
    userName: "Saqib",
    email: "saqib@omni.example",
    city: "Pune",
    requests: [
      ["Priya Nair", "+91 98220 10001", "priya.nair@omni.example", "Pune", "AC servicing", "URGENT", "NEW", "2026-10-02"],
      ["Amit Kulkarni", "+91 98220 10002", "amit.kulkarni@omni.example", "Pune", "Plumbing leak repair", "URGENT", "NEW", "2026-10-03"],
      ["Sneha Joshi", "+91 98220 10003", "sneha.joshi@omni.example", "Pune", "Deep home cleaning", "NORMAL", "QUALIFIED", "2026-10-05"],
      ["Vikram Singh", "+91 98220 10004", "vikram.singh@omni.example", "Pimpri", "Electrician for wiring check", "IMPORTANT", "QUALIFIED", "2026-10-06"],
      ["Farhan Sheikh", "+91 98220 10005", "farhan.sheikh@omni.example", "Pune", "RO water purifier service", "IMPORTANT", "QUALIFIED", "2026-10-07"],
      ["Rohan Deshmukh", "+91 98220 10006", "rohan.deshmukh@omni.example", "Nashik", "Sofa and carpet cleaning", "NORMAL", "CLOSED", "2026-10-08"],
      ["Meera Patil", "+91 98220 10007", "meera.patil@omni.example", "Pune", "Pest control", "IMPORTANT", "QUALIFIED", "2026-10-09"],
      ["Sandeep Bhosale", "+91 98220 10008", "sandeep.bhosale@omni.example", "Satara", "Geyser installation", "NORMAL", "QUALIFIED", "2026-10-10"],
    ],
  },
  {
    id: "workspace-chennai",
    name: "Chennai Beauty & Wellness",
    userId: "user-ananya",
    userName: "Ananya Iyer",
    email: "ananya@chennaibeauty.example",
    city: "Chennai",
    requests: [
      ["Kavita Reddy", "+91 98400 20001", "kavita.reddy@omni.example", "Chennai", "Bridal makeup trial", "URGENT", "NEW", "2026-10-02"],
      ["Arjun Mehta", "+91 98400 20002", "arjun.mehta@omni.example", "Chennai", "Haircut and beard styling", "NORMAL", "NEW", "2026-10-04"],
      ["Neha Gupta", "+91 98400 20003", "neha.gupta@omni.example", "Chennai", "Facial and cleanup", "NORMAL", "QUALIFIED", "2026-10-05"],
      ["Lakshmi Krishnan", "+91 98400 20004", "lakshmi.krishnan@omni.example", "Chennai", "Hair spa", "IMPORTANT", "QUALIFIED", "2026-10-06"],
      ["Imran Qureshi", "+91 98400 20005", "imran.qureshi@omni.example", "Chennai", "Groom makeover package", "URGENT", "QUALIFIED", "2026-10-07"],
      ["Divya Menon", "+91 98400 20006", "divya.menon@omni.example", "Coimbatore", "Manicure and pedicure", "NORMAL", "CLOSED", "2026-10-08"],
      ["Karthik Raman", "+91 98400 20007", "karthik.raman@omni.example", "Chennai", "Massage therapy", "IMPORTANT", "QUALIFIED", "2026-10-09"],
      ["Pooja Venkatesh", "+91 98400 20008", "pooja.venkatesh@omni.example", "Madurai", "Keratin treatment", "IMPORTANT", "QUALIFIED", "2026-10-10"],
    ],
  },
];

const seed = database.transaction(() => {
  database.exec("DELETE FROM activities; DELETE FROM work_items; DELETE FROM requests; DELETE FROM users; DELETE FROM workspaces;");
  const passwordHash = bcrypt.hashSync(demoPassword, 10);
  const addWorkspace = database.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)");
  const addUser = database.prepare(
    "INSERT INTO users (id, workspace_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, 'ADMIN')",
  );
  const addRequest = database.prepare(
    "INSERT INTO requests (id, workspace_id, customer_name, customer_phone, customer_email, customer_city, service, scheduled_date, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const addActivity = database.prepare(
    "INSERT INTO activities (id, workspace_id, request_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const addWorkItem = database.prepare(
    "INSERT INTO work_items (id, workspace_id, request_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
  );

  let nextRequestId = 1;
  for (const workspace of workspaces) {
    addWorkspace.run(workspace.id, workspace.name);
    addUser.run(workspace.userId, workspace.id, workspace.email, passwordHash, workspace.userName);

    for (const [index, row] of workspace.requests.entries()) {
      const [customer, phone, email, city, service, priority, status, scheduledDate] = row;
      const requestId = String(nextRequestId++);
      const receivedAt = new Date(Date.UTC(2026, 8, 25 + index, 9, index * 5)).toISOString();
      const updatedAt = new Date(Date.UTC(2026, 8, 26 + index, 10, index * 5)).toISOString();
      addRequest.run(
        requestId, workspace.id, customer, phone, email, city, service, scheduledDate, priority, status, receivedAt, updatedAt,
      );
      addActivity.run(randomUUID(), workspace.id, requestId, workspace.userId, "REQUEST_CREATED", receivedAt);

      if (status === "QUALIFIED") {
        addActivity.run(randomUUID(), workspace.id, requestId, workspace.userId, "REQUEST_QUALIFIED", updatedAt);
      }
      if (customer === "Farhan Sheikh" || customer === "Imran Qureshi") {
        const workItemCreatedAt = new Date(Date.UTC(2026, 8, 27, 11, index * 5)).toISOString();
        addWorkItem.run(randomUUID(), workspace.id, requestId, workspace.userId, workItemCreatedAt);
        addActivity.run(randomUUID(), workspace.id, requestId, workspace.userId, "WORK_ITEM_CREATED", workItemCreatedAt);
      }
    }
  }
});

seed();
database.close();
console.log("Seeded Pune Home Services and Chennai Beauty & Wellness with repeatable demo data.");
console.log(`Demo password for both accounts: ${demoPassword}`);
console.log("Users: saqib@omni.example and ananya@chennaibeauty.example");
