const { spawnSync } = require("child_process");
const path = require("path");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = path.resolve(__dirname, "..");

function runStep(label, commandArgs, extraEnv = {}) {
  console.log(`\n-- ${label}`);
  const result = spawnSync(npmCmd, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });

  if (result.status !== 0) {
    console.error(`${label} failed`);
    process.exit(result.status ?? 1);
  }
}

const baseUrl = process.env.WEB_E2E_BASE_URL ?? process.env.WEB_BASE_URL;
const healthUrl = process.env.STAGING_HEALTH_URL ?? process.env.HEALTH_BASE_URL;
const email = process.env.WEB_E2E_EMAIL ?? process.env.DEMO_EMAIL;
const password = process.env.WEB_E2E_PASSWORD ?? process.env.DEMO_PASSWORD;

const missing = [];
if (!healthUrl) missing.push("STAGING_HEALTH_URL");
if (!baseUrl) missing.push("WEB_E2E_BASE_URL");
if (!email) missing.push("WEB_E2E_EMAIL or DEMO_EMAIL");
if (!password) missing.push("WEB_E2E_PASSWORD or DEMO_PASSWORD");

if (missing.length > 0) {
  console.log(`staging:smoke skipped (missing env: ${missing.join(", ")})`);
  process.exit(0);
}

console.log(`Staging smoke target: ${baseUrl}`);
console.log(`Health check target: ${healthUrl}`);

runStep("Backend health-plus (staging)", ["run", "backend:health:staging"], { STAGING_HEALTH_URL: healthUrl });
runStep(
  "Web Playwright smoke + embed",
  ["run", "web:e2e:staging", "--", "e2e/smoke.spec.ts", "e2e/embed.spec.ts"],
  {
    WEB_E2E_BASE_URL: baseUrl,
    WEB_E2E_EMAIL: email,
    WEB_E2E_PASSWORD: password,
    DEMO_EMAIL: email,
    DEMO_PASSWORD: password,
  },
);

console.log("\nstaging:smoke completed.");
