/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const net = require("net");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const logsDir = path.join(repoRoot, "logs");
const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

const args = process.argv.slice(2);
let requestedChecks = [];
let jsonOutput = path.join(logsDir, "demo-ready-check.json");

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if ((arg === "--check" || arg === "--only") && args[i + 1]) {
    requestedChecks = args[i + 1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    i += 1;
  } else if (arg === "--json" && args[i + 1]) {
    jsonOutput = path.resolve(process.cwd(), args[i + 1]);
    i += 1;
  }
}

const defaultHealthUrl =
  process.env.DEMO_HEALTH_URL || "http://localhost:4000/health-plus";
const defaultDemoStatusUrl =
  process.env.DEMO_STATUS_URL || "http://localhost:4000/demo/status";
const defaultEmbedUrl =
  process.env.DEMO_EMBED_URL || "http://localhost:3000/embed";
const demoEmail =
  process.env.DEMO_EMAIL ||
  process.env.WEB_E2E_EMAIL ||
  "demo@greenbro.com";
const demoPassword =
  process.env.DEMO_PASSWORD ||
  process.env.WEB_E2E_PASSWORD ||
  "password";

const results = [];

function ensureLogsDir() {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    // best effort; readiness should not crash on log dir issues
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordResult(name, status, detail, required = true) {
  const entry = { name, status, detail, required };
  results.push(entry);
  const statusLabel = status === "PASS" ? "[PASS]" : status === "WARN" ? "[WARN]" : "[FAIL]";
  console.log(`${statusLabel} ${name}: ${detail || "ok"}`);
}

function selectChecks(allChecks) {
  if (!requestedChecks.length) return allChecks;
  const lower = requestedChecks.map((c) => c.toLowerCase());
  return allChecks.filter((check) => lower.includes(check.name.toLowerCase()));
}

function httpRequest(urlString, { method = "GET", headers = {}, body, timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(urlString);
    const lib = target.protocol === "https:" ? https : http;
    const options = {
      method,
      headers,
      timeout: timeoutMs,
    };

    const req = lib.request(target, options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode || 0,
          body: buffer.toString("utf8"),
          headers: res.headers,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function fetchJson(urlString, options = {}) {
  const res = await httpRequest(urlString, options);
  let json = null;
  try {
    json = JSON.parse(res.body || "");
  } catch (err) {
    const error = new Error(`Response from ${urlString} was not JSON`);
    error.context = { status: res.status, body: res.body };
    throw error;
  }
  return { ...res, json };
}

async function poll(fn, { label, timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = POLL_INTERVAL_MS }) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start <= timeoutMs) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await wait(intervalMs);
    }
  }

  const message = `${label || "Check"} timed out after ${Math.round(timeoutMs / 1000)}s${
    lastError?.message ? ` (${lastError.message})` : ""
  }`;
  const error = new Error(message);
  error.cause = lastError;
  throw error;
}

function checkPortOnce(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("connect timeout"));
    }, 1_000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function waitForPort(port, label) {
  await poll(
    () => checkPortOnce(port),
    { label: `${label} port ${port}`, timeoutMs: DEFAULT_TIMEOUT_MS }
  );
  return `${label} port ${port} is listening`;
}

async function pollHealthPlus(urlString) {
  return poll(async () => {
    const res = await fetchJson(urlString, {
      headers: { accept: "application/json" },
    });
    if (res.status !== 200) {
      throw new Error(`Health returned HTTP ${res.status}`);
    }
    if (!res.json || res.json.ok !== true) {
      throw new Error(`Health ok flag was not true (ok=${res.json?.ok})`);
    }
    return `ok:${res.json.ok} env:${res.json.env || "unknown"}`;
  }, { label: "backend /health-plus" });
}

async function fetchDemoToken(apiBase) {
  const loginUrl = `${apiBase}/auth/login`;
  const payload = JSON.stringify({ email: demoEmail, password: demoPassword });
  const res = await fetchJson(loginUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "content-length": `${Buffer.byteLength(payload)}`,
    },
    body: payload,
  });
  if (res.status !== 200 || !res.json?.accessToken) {
    throw new Error(
      `Login failed for demo credentials (HTTP ${res.status})`
    );
  }
  return res.json.accessToken;
}

async function pollDemoStatus(urlString) {
  const parsed = new URL(urlString);
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  const apiBase = parsed.toString().replace(/\/$/, "");
  let token = null;
  let authAttempted = false;

  return poll(async () => {
    const headers = { accept: "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetchJson(urlString, { headers });
    } catch (err) {
      if (err?.context?.status === 401 || err?.context?.status === 403) {
        throw err;
      }
      throw err;
    }

    if (res.status === 401 || res.status === 403) {
      if (!authAttempted) {
        authAttempted = true;
        if (!demoEmail || !demoPassword) {
          throw new Error("Demo status requires auth; set DEMO_EMAIL and DEMO_PASSWORD");
        }
        token = await fetchDemoToken(apiBase);
        headers.Authorization = `Bearer ${token}`;
        res = await fetchJson(urlString, { headers });
      } else {
        throw new Error(
          `Demo status unauthorized even after auth (HTTP ${res.status})`
        );
      }
    }

    if (res.status !== 200) {
      throw new Error(`Demo status returned HTTP ${res.status}`);
    }
    if (!res.json || res.json.isDemoOrg !== true) {
      throw new Error("Demo status did not report isDemoOrg=true");
    }

    return `isDemoOrg=${res.json.isDemoOrg} heroDeviceId=${res.json.heroDeviceId || "n/a"}`;
  }, { label: "backend /demo/status" });
}

async function pollEmbed(urlString) {
  return poll(async () => {
    const res = await httpRequest(urlString, {
      headers: { accept: "text/html,application/json" },
    });
    if (res.status === 200) {
      return "web embed responded 200";
    }

    const redirectStatuses = new Set([301, 302, 303, 307, 308]);
    if (redirectStatuses.has(res.status)) {
      const location = res.headers?.location || res.headers?.Location || "";
      if (location && location.includes("embed=true")) {
        return `web embed redirected (${res.status}) to ${location}`;
      }
    }

    throw new Error(`Embed responded with HTTP ${res.status}`);
  }, { label: "web /embed" });
}

function resolveAdbPath() {
  const direct = spawnSync("adb", ["version"], { encoding: "utf8" });
  if (!direct.error && direct.status === 0) {
    return "adb";
  }

  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  const candidates = sdkRoots.map((root) =>
    path.join(root, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb")
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const probe = spawnSync(candidate, ["version"], { encoding: "utf8" });
      if (!probe.error && probe.status === 0) {
        return candidate;
      }
    }
  }
  return null;
}

function parseAdbDevices(raw) {
  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("* daemon"))
    .map((line) => {
      const parts = line.split(/\s+/);
      return { id: parts[0], state: parts[1] };
    })
    .filter((entry) => entry.state === "device");
}

function checkPackageInstalled(adbPath, deviceId, packageName) {
  const res = spawnSync(adbPath, ["-s", deviceId, "shell", "pm", "path", packageName], {
    encoding: "utf8",
  });
  return res.status === 0 && res.stdout && res.stdout.includes(packageName);
}

function ensureAppRunning(adbPath, deviceId, packageName, activityName) {
  const pidCheck = spawnSync(adbPath, ["-s", deviceId, "shell", "pidof", packageName], {
    encoding: "utf8",
  });
  if (pidCheck.status === 0 && pidCheck.stdout.trim()) {
    return true;
  }

  spawnSync(adbPath, ["-s", deviceId, "shell", "am", "start", "-n", `${packageName}/${activityName}`], {
    encoding: "utf8",
  });
  const secondCheck = spawnSync(adbPath, ["-s", deviceId, "shell", "pidof", packageName], {
    encoding: "utf8",
  });
  return secondCheck.status === 0 && secondCheck.stdout.trim();
}

async function checkEmulatorApp() {
  const adbPath = resolveAdbPath();
  if (!adbPath) {
    throw new Error("adb not found on PATH; cannot verify emulator/app");
  }

  const devicesRaw = spawnSync(adbPath, ["devices"], { encoding: "utf8" });
  if (devicesRaw.status !== 0) {
    throw new Error("adb devices failed; emulator may not be running");
  }

  const readyDevices = parseAdbDevices(devicesRaw.stdout || "");
  if (!readyDevices.length) {
    throw new Error("No emulator/device detected via adb");
  }

  const target = readyDevices[0].id;
  const packageName = "com.greenbro.mobile";
  const activityName = ".MainActivity";

  if (!checkPackageInstalled(adbPath, target, packageName)) {
    throw new Error(`${packageName} not installed on ${target}`);
  }

  const running = ensureAppRunning(adbPath, target, packageName, activityName);
  if (!running) {
    throw new Error(`${packageName} did not report a running process on ${target}`);
  }

  return `${packageName} running on ${target}`;
}

async function main() {
  ensureLogsDir();

  const checks = selectChecks([
    { name: "port:4000", required: true, run: () => waitForPort(4000, "API") },
    { name: "port:3000", required: true, run: () => waitForPort(3000, "web") },
    { name: "port:8081", required: false, run: () => waitForPort(8081, "Metro") },
    { name: "health-plus", required: true, run: () => pollHealthPlus(defaultHealthUrl) },
    { name: "demo-status", required: true, run: () => pollDemoStatus(defaultDemoStatusUrl) },
    { name: "web-embed", required: true, run: () => pollEmbed(defaultEmbedUrl) },
    { name: "emulator-app", required: true, run: () => checkEmulatorApp() },
  ]);

  if (!checks.length) {
    console.error("No checks matched the provided filter; use --check <name> with one of: port:4000, port:3000, port:8081, health-plus, demo-status, web-embed, emulator-app");
    process.exitCode = 1;
    return;
  }

  let requiredFailed = false;

  for (const check of checks) {
    try {
      const detail = await check.run();
      recordResult(check.name, "PASS", detail, check.required);
    } catch (err) {
      const status = check.required ? "FAIL" : "WARN";
      const detail = err?.message || String(err);
      recordResult(check.name, status, detail, check.required);
      if (check.required) {
        requiredFailed = true;
      }
    }
  }

  try {
    fs.writeFileSync(
      jsonOutput,
      JSON.stringify({ generatedAt: new Date().toISOString(), checks: results }, null, 2),
      "utf8"
    );
  } catch (err) {
    // ignore write failures; console output is still available
  }

  const summary = results.map((r) => `${r.name}:${r.status}`).join(" | ");
  console.log(`\nSummary: ${summary}`);

  if (requiredFailed) {
    console.error("\nOne or more required checks failed.");
    process.exitCode = 1;
  } else {
    console.log("\nAll required checks passed.");
  }
}

main().catch((err) => {
  console.error(`demo-ready-check crashed: ${err?.message || err}`);
  process.exitCode = 1;
});
