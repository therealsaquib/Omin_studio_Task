const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { join } = require("node:path");

if (process.env.CLIENT_REQUEST_DESK_INSTALL_GUARD === "1") {
  process.exit(0);
}

const requireFromProject = createRequire(join(process.cwd(), "package.json"));
const requiredPackages = [
  "concurrently/package.json",
  "better-sqlite3/package.json",
  "react/package.json",
  "vite/package.json",
];

if (requiredPackages.every((name) => {
  try {
    requireFromProject.resolve(name);
    return true;
  } catch {
    return false;
  }
})) {
  console.log("Root and workspace dependencies are already installed.");
  process.exit(0);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["install"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CLIENT_REQUEST_DESK_INSTALL_GUARD: "1" },
});

process.exit(result.status ?? 1);
