const isWindows = process.platform === 'win32';
const gradlewCommand = isWindows ? 'gradlew.bat' : './gradlew';

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    type: 'jest',
    jest: {
      setupTimeout: 180000,
    },
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.e2e.js',
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: `cd android && ${gradlewCommand} assembleDebug assembleAndroidTest -DtestBuildType=debug`,
      reversePorts: [8081],
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_API_34',
      },
    },
  },
  configurations: {
    'android.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
  behavior: {
    init: {
      exposeGlobals: true,
    },
    launchApp: 'auto',
  },
  artifacts: {
    retainOnFail: true,
  },
};
