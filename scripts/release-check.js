const { spawnSync } = require("child_process");
const path = require("path");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const isFast = args.includes("--fast");
const isCi = args.includes("--ci") || String(process.env.CI).toLowerCase() === "true";

function runStep(label, commandArgs, options = {}) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(npmCmd, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
  });

  if (result.status !== 0) {
    console.error(`Step failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function logSkip(message) {
  console.log(`- ${message}`);
}

const mode = isFast ? "fast" : isCi ? "ci" : "local";
console.log(`Starting release:check (${mode} mode)`);

runStep("Lint (backend, web, mobile)", ["run", "lint"]);
runStep("Typecheck (backend, web, mobile)", ["run", "typecheck"]);

if (isFast) {
  console.log("\nFast mode: skipping tests, coverage, and staging smoke.");
} else {
  runStep("Backend tests + coverage", ["run", "test:backend:coverage"]);
  runStep("Mobile unit tests", ["run", "test:mobile"]);
  runStep("Web tests + coverage", ["run", "test:web:coverage"]);

  const stagingEnv = [
    ["STAGING_HEALTH_URL", process.env.STAGING_HEALTH_URL ?? process.env.HEALTH_BASE_URL],
    ["WEB_E2E_BASE_URL", process.env.WEB_E2E_BASE_URL ?? process.env.WEB_BASE_URL],
    ["WEB_E2E_EMAIL/DEMO_EMAIL", process.env.WEB_E2E_EMAIL ?? process.env.DEMO_EMAIL],
    ["WEB_E2E_PASSWORD/DEMO_PASSWORD", process.env.WEB_E2E_PASSWORD ?? process.env.DEMO_PASSWORD],
  ];
  const missing = stagingEnv.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    logSkip(`Staging smoke skipped (missing env: ${missing.join(", ")})`);
  } else {
    runStep("Staging smoke (health + Playwright smoke/embed)", ["run", "staging:smoke"]);
  }
}

const includeWebE2E = process.env.RELEASE_WEB_E2E === "true" || process.env.RELEASE_CHECK_WEB_E2E === "true";
if (includeWebE2E && !isFast) {
  runStep("Web e2e suite", ["run", "web:e2e"]);
} else if (includeWebE2E && isFast) {
  logSkip("Web e2e requested but fast mode omits integration suites.");
} else {
  logSkip("Web e2e skipped (set RELEASE_WEB_E2E=true to include)");
}

const includeDetox = process.env.RELEASE_ANDROID_E2E === "true" || process.env.RELEASE_INCLUDE_DETOX === "true";
if (includeDetox && !isFast) {
  runStep("Android Detox e2e", ["run", "release:e2e:android"]);
} else if (includeDetox && isFast) {
  logSkip("Android Detox requested but fast mode omits integration suites.");
} else {
  logSkip("Android Detox e2e skipped (run npm run release:e2e:android when ready)");
}

console.log("\nrelease:check completed successfully.");
