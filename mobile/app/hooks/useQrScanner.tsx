import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CameraView,
  type BarcodeScanningResult,
  type PermissionResponse,
} from 'expo-camera';

export type QrPermissionStatus = 'checking' | 'granted' | 'denied';

export type QrScannerAdapter = {
  permission: QrPermissionStatus;
  requestPermission: () => Promise<void>;
  ScannerView: React.ComponentType<{ onCodeScanned: (text: string) => void; testID?: string }>;
};

export function useQrScanner(enabled: boolean): QrScannerAdapter {
  const [permission, setPermission] = useState<QrPermissionStatus>('checking');

  const requestPermission = useCallback(async () => {
    const response: PermissionResponse = await Camera.requestCameraPermissionsAsync();
    setPermission(response.status === 'granted' ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPermission('denied');
      return;
    }

    const syncPermissions = async () => {
      const response: PermissionResponse = await Camera.getCameraPermissionsAsync();
      if (response.status === 'granted') {
        setPermission('granted');
        return;
      }

      await requestPermission();
    };

    syncPermissions().catch(() => setPermission('denied'));
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
          (event: BarcodeScanningResult) => {
            if (event?.data) {
              onCodeScanned(event.data);
            }
          },
          [onCodeScanned]
        );

        return (
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            testID={testID}
          />
        );
      },
    []
  );

  return { permission, requestPermission, ScannerView };
}
