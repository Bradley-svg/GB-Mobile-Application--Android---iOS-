import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarCodeScanner,
  type BarCodeEvent,
  type PermissionResponse,
} from 'expo-barcode-scanner';

export type QrPermissionStatus = 'checking' | 'granted' | 'denied';

export type QrScannerAdapter = {
  permission: QrPermissionStatus;
  requestPermission: () => Promise<void>;
  ScannerView: React.ComponentType<{ onCodeScanned: (text: string) => void; testID?: string }>;
};

export function useQrScanner(enabled: boolean): QrScannerAdapter {
  const [permission, setPermission] = useState<QrPermissionStatus>('checking');

  const requestPermission = useCallback(async () => {
    const response: PermissionResponse = await BarCodeScanner.requestPermissionsAsync();
    setPermission(response.status === 'granted' ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPermission('denied');
      return;
    }

    requestPermission().catch(() => setPermission('denied'));
  }, [enabled, requestPermission]);

  const ScannerView = useMemo(
    () =>
      function ScannerViewComponent({
        onCodeScanned,
        testID,
      }: {
        onCodeScanned: (text: string) => void;
        testID?: string;
      }) {
        const handleScan = useCallback(
          (event: BarCodeEvent) => {
            if (event?.data) {
              onCodeScanned(event.data);
            }
          },
          [onCodeScanned]
        );

        return (
          <BarCodeScanner
            style={{ flex: 1 }}
            onBarCodeScanned={handleScan}
            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
            testID={testID}
          />
        );
      },
    []
  );

  return { permission, requestPermission, ScannerView };
}
