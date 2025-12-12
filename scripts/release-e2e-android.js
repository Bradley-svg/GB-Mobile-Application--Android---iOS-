const fs = require("fs");
const { spawnSync } = require("child_process");
const net = require("net");
const path = require("path");
const { waitForEmulator, waitForAppReady } = require("./android-wait");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const mobileDir = path.resolve(__dirname, "..", "mobile");
const apkPath = path.resolve(mobileDir, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const APP_PACKAGE = "com.greenbro.mobile";
const MAIN_ACTIVITY = "com.greenbro.mobile/.MainActivity";
const READY_TEST_ID = "LoginScreen";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureMetro(port = 8081) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port, timeout: 1500 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function ensureApkBuilt() {
  if (fs.existsSync(apkPath)) {
    return;
  }

  console.log("Detox APK missing; building android.debug...");
  const buildResult = spawnSync(npmCmd, ["run", "e2e:build:android"], {
    cwd: mobileDir,
    stdio: "inherit",
    env: { ...process.env },
  });

  if (buildResult.status !== 0) {
    fail("Detox build failed");
  }
}

async function main() {
  console.log("Android Detox preflight: checking emulator, Metro, and app readiness...");
  ensureApkBuilt();

  const metroReady = await ensureMetro();
  if (!metroReady) {
    fail('Metro bundler not reachable on port 8081. Start it with "cd mobile && npm run start:devclient -- --port 8081".');
  }

  const deviceId = await waitForEmulator({ packageName: APP_PACKAGE, apkPath });
  await waitForAppReady({
    packageName: APP_PACKAGE,
    mainActivity: MAIN_ACTIVITY,
    readyTestId: READY_TEST_ID,
    artifactsDir: path.resolve(__dirname, "..", "logs", "detox-preflight"),
    deviceId,
  });

  console.log("Preflight OK. Running Detox tests...");
  const result = spawnSync(npmCmd, ["run", "e2e:test:android", "--", "--headless", "--reuse"], {
    cwd: mobileDir,
    stdio: "inherit",
    env: { ...process.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((err) => {
  fail(`release:e2e:android failed: ${err instanceof Error ? err.message : String(err)}`);
});
