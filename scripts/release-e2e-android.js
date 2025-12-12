const { spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const mobileDir = path.resolve(__dirname, "..", "mobile");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureAdbDevice() {
  const adbResult = spawnSync("adb", ["devices"], { encoding: "utf-8" });

  if (adbResult.status !== 0 || adbResult.error) {
    fail("adb is required for Detox. Make sure Android platform tools are installed and on your PATH.");
  }

  const hasDevice = adbResult.stdout
    .split("\n")
    .some((line) => line.trim() && /\tdevice\b/.test(line.trim()));

  if (!hasDevice) {
    fail("No Android emulator/device detected. Start an emulator (e.g. Pixel_API_34) and retry.");
  }
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

async function main() {
  console.log("Android Detox preflight: checking adb/emulator/Metro...");
  ensureAdbDevice();

  const metroReady = await ensureMetro();
  if (!metroReady) {
    fail('Metro bundler not reachable on port 8081. Start it with "cd mobile && npm run start:devclient -- --port 8081".');
  }

  console.log("Preflight OK. Running Detox tests...");
  const result = spawnSync(npmCmd, ["run", "e2e:test:android"], {
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
