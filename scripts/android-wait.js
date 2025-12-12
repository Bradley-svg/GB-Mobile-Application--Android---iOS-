const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_PACKAGE = "com.greenbro.mobile";
const DEFAULT_ACTIVITY = "com.greenbro.mobile/.MainActivity";
const DEFAULT_READY_TEST_ID = "LoginScreen";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runAdb(args, options = {}) {
  const { deviceId, encoding = "utf-8", allowFailure = false, stdio } = options;
  const finalArgs = deviceId ? ["-s", deviceId, ...args] : args;
  const spawnOptions = {
    encoding: encoding === "buffer" ? undefined : encoding,
    stdio,
  };
  const result = spawnSync("adb", finalArgs, spawnOptions);

  if (result.error) {
    if (allowFailure) return result;
    throw new Error(`adb ${args.join(" ")} failed: ${result.error.message}`);
  }

  if (!allowFailure && result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : "";
    const stdout = result.stdout ? result.stdout.toString() : "";
    throw new Error(`adb ${args.join(" ")} failed (${result.status}): ${stderr || stdout}`.trim());
  }

  return result;
}

function parseDevices(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.toLowerCase().startsWith("list of devices"))
    .map((line) => {
      const [serial, status] = line.split(/\s+/);
      return { serial, status };
    });
}

async function waitForDeviceOnline(targetId, deadlineMs) {
  while (Date.now() < deadlineMs) {
    const result = runAdb(["devices"], { allowFailure: true });
    const devices = parseDevices(result.stdout?.toString() || "");
    const available = devices.filter((d) => d.status === "device");
    const match = targetId
      ? available.find((d) => d.serial === targetId)
      : available.length > 0
      ? available[0]
      : null;

    if (match) {
      return match.serial;
    }

    await delay(2000);
  }

  throw new Error("Timed out waiting for an online Android emulator/device.");
}

async function waitForBootCompleted(deviceId, deadlineMs) {
  while (Date.now() < deadlineMs) {
    const sysBoot = runAdb(["shell", "getprop", "sys.boot_completed"], {
      deviceId,
      allowFailure: true,
    });
    const devBoot = runAdb(["shell", "getprop", "dev.bootcomplete"], {
      deviceId,
      allowFailure: true,
    });
    const booted =
      sysBoot.stdout?.toString().trim() === "1" || devBoot.stdout?.toString().trim() === "1";
    if (booted) return;
    await delay(2000);
  }

  throw new Error("Timed out waiting for emulator boot completion.");
}

function wakeAndUnlock(deviceId) {
  runAdb(["shell", "input", "keyevent", "224"], { deviceId, allowFailure: true });
  runAdb(["shell", "input", "keyevent", "82"], { deviceId, allowFailure: true });
}

function packageInstalled(packageName, deviceId) {
  const res = runAdb(["shell", "pm", "path", packageName], { deviceId, allowFailure: true });
  const output = res.stdout?.toString() || "";
  return res.status === 0 && output.includes("package:");
}

function installApk(apkPath, deviceId) {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found at ${apkPath}`);
  }
  console.log(`Installing ${apkPath} to ${deviceId || "emulator"}...`);
  const res = runAdb(["install", "-r", apkPath], { deviceId, stdio: "inherit", allowFailure: true });
  if (res.status !== 0) {
    throw new Error(`adb install failed for ${apkPath}`);
  }
}

async function ensurePackageAvailable(packageName, deviceId, apkPath) {
  if (packageInstalled(packageName, deviceId)) return;
  if (apkPath) {
    installApk(apkPath, deviceId);
    if (packageInstalled(packageName, deviceId)) return;
  }

  throw new Error(
    `Package ${packageName} is not installed on ${deviceId || "emulator"}. Build and install the app, then retry.`
  );
}

async function waitForEmulator(options = {}) {
  const {
    packageName = DEFAULT_PACKAGE,
    apkPath,
    timeoutMs = 180000,
    deviceId = process.env.ANDROID_SERIAL,
  } = options;
  const deadline = Date.now() + timeoutMs;

  console.log("Waiting for emulator/device to be online...");
  const targetDeviceId = await waitForDeviceOnline(deviceId, deadline);
  console.log(`Found device ${targetDeviceId}. Waiting for boot to complete...`);
  await waitForBootCompleted(targetDeviceId, deadline);
  wakeAndUnlock(targetDeviceId);
  await ensurePackageAvailable(packageName, targetDeviceId, apkPath);
  console.log(`Emulator ${targetDeviceId} ready and ${packageName} installed.`);
  return targetDeviceId;
}

async function waitForTestId(readyTestId, deviceId, deadlineMs) {
  while (Date.now() < deadlineMs) {
    const dump = runAdb(["exec-out", "uiautomator", "dump", "/dev/tty"], {
      deviceId,
      allowFailure: true,
    });
    const xml = dump.stdout?.toString() || "";
    if (dump.status === 0 && xml.includes(readyTestId)) {
      return true;
    }
    await delay(2000);
  }
  return false;
}

async function captureArtifacts(deviceId, testId, artifactsDir) {
  await fs.promises.mkdir(artifactsDir, { recursive: true });
  const logPath = path.join(artifactsDir, "app-ready-logcat.txt");
  const screenshotPath = path.join(artifactsDir, "app-ready.png");
  const uiDumpPath = path.join(artifactsDir, "app-ready-ui.xml");

  const log = runAdb(["logcat", "-d", "-t", "200"], { deviceId, allowFailure: true });
  const logOutput = log.stdout?.toString() || log.stderr?.toString() || "";
  fs.writeFileSync(logPath, logOutput);

  const screenshot = runAdb(["exec-out", "screencap", "-p"], {
    deviceId,
    encoding: "buffer",
    allowFailure: true,
  });
  if (screenshot.stdout?.length) {
    fs.writeFileSync(screenshotPath, screenshot.stdout);
  }

  const uiDump = runAdb(["exec-out", "uiautomator", "dump", "/dev/tty"], {
    deviceId,
    allowFailure: true,
  });
  const uiOutput = uiDump.stdout?.toString() || uiDump.stderr?.toString() || "";
  fs.writeFileSync(uiDumpPath, uiOutput);

  console.warn(
    `App did not reach ${testId}. Captured logcat (${logPath}), screenshot (${screenshotPath}), and UI dump (${uiDumpPath}).`
  );
}

async function waitForAppReady(options = {}) {
  const {
    packageName = DEFAULT_PACKAGE,
    mainActivity = DEFAULT_ACTIVITY,
    readyTestId = DEFAULT_READY_TEST_ID,
    timeoutMs = 90000,
    deviceId = process.env.ANDROID_SERIAL,
    artifactsDir = path.resolve(__dirname, "..", "logs", "detox-preflight"),
  } = options;
  const deadline = Date.now() + timeoutMs;
  const targetDeviceId = await waitForDeviceOnline(deviceId, deadline);

  if (!packageInstalled(packageName, targetDeviceId)) {
    throw new Error(
      `Package ${packageName} is not installed on ${targetDeviceId || "emulator"}. Run the emulator wait step with --apk first.`
    );
  }

  runAdb(["logcat", "-c"], { deviceId: targetDeviceId, allowFailure: true });
  console.log(`Launching ${mainActivity} on ${targetDeviceId}...`);
  runAdb(["shell", "am", "start", "-n", mainActivity, "-W"], {
    deviceId: targetDeviceId,
    allowFailure: true,
  });

  const ready = await waitForTestId(readyTestId, targetDeviceId, deadline);
  if (ready) {
    console.log(`Found ${readyTestId} on ${targetDeviceId}. App is ready.`);
    return true;
  }

  await captureArtifacts(targetDeviceId, readyTestId, artifactsDir);
  throw new Error(`App did not render ${readyTestId} within ${timeoutMs}ms.`);
}

function parseCliOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--package":
        options.packageName = argv[i + 1];
        i += 1;
        break;
      case "--apk":
        options.apkPath = path.resolve(argv[i + 1]);
        i += 1;
        break;
      case "--activity":
        options.mainActivity = argv[i + 1];
        i += 1;
        break;
      case "--test-id":
        options.readyTestId = argv[i + 1];
        i += 1;
        break;
      case "--timeout":
        options.timeoutMs = Number(argv[i + 1]);
        i += 1;
        break;
      case "--artifacts":
        options.artifactsDir = path.resolve(argv[i + 1]);
        i += 1;
        break;
      case "--device":
        options.deviceId = argv[i + 1];
        i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

async function runCli() {
  const [mode, ...rest] = process.argv.slice(2);
  const options = parseCliOptions(rest);

  try {
    if (mode === "app") {
      await waitForAppReady(options);
    } else {
      await waitForEmulator(options);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  waitForEmulator,
  waitForAppReady,
};
