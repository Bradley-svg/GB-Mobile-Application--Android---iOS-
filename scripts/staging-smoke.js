const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = path.resolve(__dirname, "..");
const SMOKE_ENV_FLAG = "__STAGING_SMOKE_ENV_LOADED";

const results = [];

function tryLoadDotenv(filePath) {
  const candidates = [
    () => require("dotenv"),
    () => require(path.join(repoRoot, "backend", "node_modules", "dotenv")),
    () => require(path.join(repoRoot, "web", "node_modules", "dotenv")),
  ];

  for (const loader of candidates) {
    try {
      const mod = loader();
      if (mod?.config) {
        mod.config({ path: filePath, override: false });
        return true;
      }
    } catch (err) {
      // ignore resolution errors and fall back to manual parsing
    }
  }
  return false;
}

function loadEnvFile(filePath) {
  if (process.env[SMOKE_ENV_FLAG]) return;
  if (!fs.existsSync(filePath)) return;

  const loadedWithDotenv = tryLoadDotenv(filePath);
  if (!loadedWithDotenv) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [rawKey, ...rawRest] = trimmed.split("=");
      const key = rawKey.trim();
      const rawValue = rawRest.join("=").trim();
      if (!key) continue;
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  process.env[SMOKE_ENV_FLAG] = "true";
  console.log(`Loaded staging smoke env from ${filePath}`);
}

function ensureEnvLoaded() {
  const envFile =
    process.env.STAGING_SMOKE_ENV_FILE || path.join(repoRoot, ".env.staging-smoke");
  loadEnvFile(envFile);
}

function formatDuration(ms) {
  return `${ms}ms`;
}

async function runStep(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", duration: Date.now() - start });
    return detail;
  } catch (err) {
    const context = err?.context || {};
    results.push({ name, status: "FAIL", duration: Date.now() - start, context });
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      context: { ...context, step: name },
    });
  }
}

function deriveHealthUrl(raw) {
  const trimmed = (raw || "").replace(/\/$/, "");
  if (!trimmed) return trimmed;
  return trimmed.endsWith("/health-plus") ? trimmed : `${trimmed}/health-plus`;
}

function deriveApiBase(raw) {
  if (!raw) return "";
  try {
    const healthUrl = deriveHealthUrl(raw);
    const parsed = new URL(healthUrl);
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (err) {
    return raw.replace(/\/health-plus.*$/, "").replace(/\/$/, "");
  }
}

async function checkHealthPlus(healthBase) {
  const target = deriveHealthUrl(healthBase);
  const res = await fetch(target, { headers: { accept: "application/json" } });
  let body;
  try {
    body = await res.json();
  } catch (err) {
    const error = new Error(`Health-plus response was not JSON (${target})`);
    error.context = { url: target };
    throw error;
  }

  const subsystems = ["mqtt", "control", "heatPumpHistory", "push"];
  console.log(`\nHealth-plus @ ${target}`);
  console.log(`ok=${body?.ok} env=${body?.env ?? "unknown"} version=${body?.version ?? "unknown"}`);
  subsystems.forEach((key) => {
    const sub = body?.[key];
    if (!sub) return;
    const disabled = sub.disabled ? " (disabled)" : "";
    const healthy = sub.healthy === false ? "issue" : "ok";
    console.log(` - ${key}: ${healthy}${disabled}`);
  });
  const vendorDisabled = (body?.vendorFlags?.disabled ?? []).join(", ") || "None";
  console.log(`Vendor disabled: ${vendorDisabled}`);

  if (!res.ok || body?.ok !== true) {
    const error = new Error(`Health-plus check failed (ok=${body?.ok}, status=${res.status})`);
    error.context = { url: target };
    throw error;
  }

  return { vendorFlags: body?.vendorFlags, target };
}

async function loginForToken(apiBase, email, password) {
  const loginUrl = `${apiBase}/auth/login`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.accessToken) {
    const error = new Error(`Login failed for demo credentials (${res.status})`);
    error.context = { url: loginUrl };
    throw error;
  }
  return body.accessToken;
}

async function checkDemoStatus(apiBase, email, password) {
  const demoUrl = `${apiBase}/demo/status`;
  const headers = { accept: "application/json" };
  if (email && password) {
    const token = await loginForToken(apiBase, email, password);
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(demoUrl, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`Demo status failed (${res.status})`);
    error.context = { url: demoUrl };
    throw error;
  }
  if (!body?.isDemoOrg) {
    const error = new Error('Demo status did not report isDemoOrg=true');
    error.context = { url: demoUrl };
    throw error;
  }

  console.log(`Demo status: isDemoOrg=${body.isDemoOrg} heroDeviceId=${body.heroDeviceId ?? "n/a"}`);
  const vendorDisabled = (body?.vendorFlags?.disabled ?? []).join(", ") || "None";
  console.log(`Vendor flags: ${vendorDisabled}`);
  return body;
}

function runPlaywright(baseUrl, email, password, heroDeviceId) {
  const env = {
    ...process.env,
    WEB_E2E_BASE_URL: baseUrl,
    WEB_E2E_EMAIL: email,
    WEB_E2E_PASSWORD: password,
    DEMO_EMAIL: email,
    DEMO_PASSWORD: password,
  };
  if (heroDeviceId) {
    env.WEB_E2E_HERO_DEVICE_ID = heroDeviceId;
  }

  console.log("\nRunning Playwright smoke (web:e2e:smoke)...");
  const result = spawnSync(npmCmd, ["run", "web:e2e:smoke"], {
    cwd: repoRoot,
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    const error = new Error("Playwright smoke failed");
    error.context = {
      url: baseUrl,
      artifacts: path.join(repoRoot, "web", "playwright-report"),
    };
    throw error;
  }

  return { artifacts: path.join(repoRoot, "web", "playwright-report") };
}

function printSummary(stepResults) {
  console.log("\nStep summary");
  console.log("STEP".padEnd(22), "STATUS".padEnd(8), "DURATION");
  stepResults.forEach((step) => {
    console.log(
      step.name.padEnd(22),
      step.status.padEnd(8),
      formatDuration(step.duration || 0)
    );
  });
}

async function main() {
  ensureEnvLoaded();

  const config = {
    healthUrl: process.env.STAGING_HEALTH_URL || process.env.HEALTH_BASE_URL || "",
    baseUrl: process.env.WEB_E2E_BASE_URL || process.env.WEB_BASE_URL || "",
    email: process.env.WEB_E2E_EMAIL || process.env.DEMO_EMAIL || "",
    password: process.env.WEB_E2E_PASSWORD || process.env.DEMO_PASSWORD || "",
  };

  const missing = Object.entries({
    STAGING_HEALTH_URL: config.healthUrl,
    WEB_E2E_BASE_URL: config.baseUrl,
    WEB_E2E_EMAIL: config.email,
    WEB_E2E_PASSWORD: config.password,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `Missing required env vars: ${missing.join(", ")}. Copy docs/staging-smoke.env.example to .env.staging-smoke and fill in values.`
    );
    printSummary(results);
    process.exit(1);
  }

  const apiBase = deriveApiBase(config.healthUrl);
  let heroDeviceId = process.env.WEB_E2E_HERO_DEVICE_ID || "";

  try {
    await runStep("health-plus", () => checkHealthPlus(config.healthUrl));
    const demoStatus = await runStep("demo-status", () =>
      checkDemoStatus(apiBase, config.email, config.password)
    );
    if (demoStatus?.heroDeviceId) {
      heroDeviceId = demoStatus.heroDeviceId;
    }
    await runStep("playwright", () =>
      runPlaywright(config.baseUrl, config.email, config.password, heroDeviceId)
    );
    console.log("\nstaging:smoke completed.");
  } catch (err) {
    console.error(`staging:smoke failed: ${err?.message || err}`);
    if (err?.context?.url) {
      console.error(`Failing URL (${err.context.step || "unknown"}): ${err.context.url}`);
    }
    if (err?.context?.artifacts) {
      console.error(`Artifacts available at ${err.context.artifacts}`);
    }
  } finally {
    printSummary(results);
    const failed = results.find((r) => r.status === "FAIL");
    if (failed) {
      if (failed.context?.url) {
        console.error(`Failing URL (${failed.name}): ${failed.context.url}`);
      }
      if (failed.context?.artifacts) {
        console.error(`Artifacts: ${failed.context.artifacts}`);
      } else {
        console.error(
          `Playwright artifacts (if any) are in ${path.join(repoRoot, "web", "playwright-report")}`
        );
      }
      process.exit(1);
    }
  }
}

main();
