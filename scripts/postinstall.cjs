/**
 * Runs packaged postinstall only when `dist/` exists (dev clone before first build).
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const target = path.join(__dirname, "..", "dist", "cli", "postinstall.js");
if (fs.existsSync(target)) {
  const r = spawnSync(process.execPath, [target], { stdio: "inherit" });
  if (r.status != null && r.status !== 0) {
    process.exit(r.status);
  }
}
