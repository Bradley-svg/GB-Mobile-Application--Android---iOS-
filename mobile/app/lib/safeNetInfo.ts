type NetInfoType = typeof import('@react-native-community/netinfo');

let cachedNetInfo: NetInfoType | null | undefined;

export function getSafeNetInfo(): NetInfoType | null {
  if (cachedNetInfo !== undefined) return cachedNetInfo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo') as NetInfoType;
    // accessing something on mod will force its init and throw if RNCNetInfo is null
    void mod.addEventListener;
    cachedNetInfo = mod;
  } catch (err) {
    console.warn(
      'NetInfo native module not available - treating app as always-online. Rebuild the dev client with @react-native-community/netinfo installed.',
      err instanceof Error ? err.message : err
    );
    cachedNetInfo = null;
  }
  return cachedNetInfo;
}
