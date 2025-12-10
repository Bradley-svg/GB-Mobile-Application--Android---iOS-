import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { lookupDeviceByCode } from '../../api/client';
import { Screen, Card, GlobalErrorBanner, ErrorCard, PrimaryButton, RoleRestrictedHint } from '../../components';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useAppTheme } from '../../theme/useAppTheme';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { typography } from '../../theme/typography';
import { useAuthStore } from '../../store/authStore';
import type { AppTheme } from '../../theme/types';
import { useQrScanner, type QrScannerAdapter } from '../../hooks/useQrScanner';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type ScanError =
  | { type: 'not_found'; message: string }
  | { type: 'forbidden'; message: string }
  | null;

type ScanDeviceScreenProps = {
  scannerAdapter?: QrScannerAdapter;
};

export const ScanDeviceScreen: React.FC<ScanDeviceScreenProps> = ({ scannerAdapter }) => {
  const navigation = useNavigation<Navigation>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const canScan = role === 'owner' || role === 'admin' || role === 'facilities';

  const [error, setError] = useState<ScanError>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScanRef = useRef<string | null>(null);
  const defaultScanner = useQrScanner(canScan);
  const { permission, requestPermission, ScannerView } = scannerAdapter ?? defaultScanner;

  const handleScan = useCallback(
    async (scannedCode: string) => {
      if (!canScan || !scannedCode || isProcessing) return;
      if (lastScanRef.current === scannedCode) return;
      lastScanRef.current = scannedCode;
      setError(null);
      setNetworkError(null);
      setIsProcessing(true);

      try {
        const response = await lookupDeviceByCode(scannedCode);
        navigation.navigate('DeviceDetail', { deviceId: response.device.id });
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const code = (err.response?.data as { code?: string } | undefined)?.code;
          if (status === 404 || code === 'ERR_DEVICE_CODE_NOT_FOUND') {
            setError({ type: 'not_found', message: 'Device not found for this QR code.' });
          } else if (status === 403 || code === 'ERR_QR_FORBIDDEN') {
            setError({ type: 'forbidden', message: "You don't have access to this device." });
          } else {
            setNetworkError('Unable to look up this device. Please try again.');
          }
        } else {
          setNetworkError('Unable to look up this device. Please try again.');
        }
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          lastScanRef.current = null;
        }, 300);
      }
    },
    [canScan, isProcessing, navigation]
  );

  const renderScanner = () => {
    if (!canScan) {
      return (
        <RoleRestrictedHint
          action="scan devices"
          allowedRoles={['owner', 'admin', 'facilities']}
          testID="scan-device-restricted"
        />
      );
    }

    if (permission === 'checking') {
      return (
        <ErrorCard
          title="Requesting permission"
          message="Requesting camera access to scan the QR code."
          testID="scan-device-permission"
        />
      );
    }

    if (permission === 'denied') {
      return (
        <View style={styles.permissionContainer}>
          <ErrorCard
            title="Camera permission denied"
            message="Enable camera access to scan devices."
            testID="scan-device-permission-denied"
          />
          <PrimaryButton
            label="Grant permission"
            onPress={() => requestPermission().catch(() => setNetworkError('Unable to request permission'))}
            style={styles.permissionButton}
            variant="outline"
            testID="scan-device-permission-button"
          />
        </View>
      );
    }

    return (
      <View style={styles.scannerWrapper} testID="scan-device-frame">
        <ScannerView onCodeScanned={handleScan} testID="scan-device-scanner" />
        <Text style={[typography.caption, styles.frameHint]}>Align the QR code inside the frame.</Text>
      </View>
    );
  };

  return (
    <Screen scroll={false} testID="scan-device-screen">
      {networkError ? (
        <GlobalErrorBanner message={networkError} testID="scan-device-network-error" />
      ) : null}
      <Card style={styles.card}>
        <Text style={[typography.title2, styles.title]}>Scan device</Text>
        <Text style={[typography.body, styles.subtitle]}>
          Align the QR code inside the frame to open the device.
        </Text>
        <View style={styles.frameContainer}>{renderScanner()}</View>
        {error?.type === 'not_found' ? (
          <ErrorCard
            title="Device not found"
            message={error.message}
            testID="scan-device-error"
          />
        ) : null}
        {error?.type === 'forbidden' ? (
          <ErrorCard
            title="No access"
            message={error.message}
            testID="scan-device-error"
          />
        ) : null}
        <PrimaryButton
          label="Cancel"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          disabled={isProcessing}
          testID="scan-device-cancel"
          variant="outline"
        />
      </Card>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    card: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.lg,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    frameContainer: {
      marginVertical: theme.spacing.lg,
    },
    scannerWrapper: {
      height: 280,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.colors.brandGreen,
      backgroundColor: theme.colors.backgroundAlt,
    },
    frameHint: {
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    cancelButton: {
      marginTop: theme.spacing.lg,
    },
    permissionContainer: {
      marginTop: theme.spacing.md,
    },
    permissionButton: {
      marginTop: theme.spacing.sm,
    },
  });
