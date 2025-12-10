import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type ScanError =
  | { type: 'not_found'; message: string }
  | { type: 'forbidden'; message: string }
  | null;

export const ScanDeviceScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const canScan = role === 'owner' || role === 'admin' || role === 'facilities';

  const [error, setError] = useState<ScanError>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScanRef = useRef<string | null>(null);

  const mockCode = 'device:33333333-3333-3333-3333-333333333333';

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
        {!canScan ? (
          <RoleRestrictedHint
            action="scan devices"
            allowedRoles={['owner', 'admin', 'facilities']}
            testID="scan-device-restricted"
          />
        ) : null}
        <View style={styles.frameContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.scanFrame}
            disabled={!canScan || isProcessing}
            onPress={() => handleScan(mockCode)}
            testID="scan-device-frame"
            accessibilityLabel="scan-device-frame"
          >
            <Text style={[typography.caption, styles.frameHint]}>
              Tap to simulate scan
            </Text>
            <Text style={[typography.caption, styles.frameSubtle]}>
              TODO: wire up the camera scanner when available.
            </Text>
          </TouchableOpacity>
        </View>
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
    scanFrame: {
      height: 220,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.brandGreen,
      backgroundColor: theme.colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.md,
    },
    frameHint: {
      color: theme.colors.textPrimary,
    },
    frameSubtle: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    cancelButton: {
      marginTop: theme.spacing.lg,
    },
  });
