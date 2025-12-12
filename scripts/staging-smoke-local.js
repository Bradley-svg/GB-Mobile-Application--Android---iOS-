const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const envArgIdx = process.argv.findIndex((arg) => arg === "--env" || arg === "--env-file");
const envFile =
  (envArgIdx !== -1 && process.argv[envArgIdx + 1]
    ? path.resolve(process.argv[envArgIdx + 1])
    : process.env.STAGING_SMOKE_ENV_FILE) || path.join(repoRoot, ".env.staging-smoke");

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
      // Ignore module resolution failures and keep trying fallbacks
    }
  }

  return false;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(
      `Missing ${path.basename(filePath)}. Copy docs/staging-smoke.env.example to ${filePath} and fill in staging values.`
    );
    process.exit(1);
  }

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

  console.log(`Loaded staging smoke env from ${filePath}`);
}

loadEnvFile(envFile);

require("./staging-smoke");
