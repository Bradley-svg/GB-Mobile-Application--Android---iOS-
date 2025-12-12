import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  TouchableOpacity,
  View,
  Text,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { isAdminOrOwner, isContractor, isFacilities } from '../../store/authStore';
import {
  Screen,
  Card,
  PrimaryButton,
  IconButton,
  StatusPill,
  DemoModePill,
  VendorDisabledBanner,
} from '../../components';
import { getNotificationPermissionStatus } from '../../hooks/usePushRegistration';
import { useNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from '../../api/preferences/hooks';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../api/preferences/storage';
import { useDemoStatus } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { formatVendorDisabledSummary } from '../../components/VendorDisabledBanner';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { clearAuth, user, notificationPreferences } = useAuthStore((s) => ({
    clearAuth: s.clearAuth,
    user: s.user,
    notificationPreferences: s.notificationPreferences,
  }));
  const {
    data: storedPreferences,
    isLoading: preferencesLoading,
    isFetching: preferencesFetching,
  } = useNotificationPreferencesQuery();
  const updatePreferences = useUpdateNotificationPreferencesMutation();
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const initials = useMemo(() => {
    const name = user?.name || 'G B';
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [user?.name]);

  useEffect(() => {
    const loadPermissionStatus = async () => {
      const status = await getNotificationPermissionStatus();
      setNotificationPermission(status);
    };

    loadPermissionStatus();
  }, []);

  const onLogout = async () => {
    await clearAuth();
  };

  const onOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.error('Failed to open notification settings', err);
    }
  };

  const notificationDenied = notificationPermission === 'denied';
  const alertsEnabled =
    notificationPreferences?.alertsEnabled ??
    storedPreferences?.alertsEnabled ??
    DEFAULT_NOTIFICATION_PREFERENCES.alertsEnabled;
  const toggleDisabled =
    notificationDenied || preferencesLoading || preferencesFetching || updatePreferences.isPending;
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown';
  const canShare = isAdminOrOwner(user?.role) || isFacilities(user?.role);
  const contractorRole = isContractor(user?.role);
  const showTwoFactor = isAdminOrOwner(user?.role) || isFacilities(user?.role);
  const twoFactorEnabled = user?.two_factor_enabled === true;
  const { theme, mode, resolvedScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing, typography } = theme;
  const themeLabel =
    mode === 'system'
      ? `System (${resolvedScheme})`
      : mode.charAt(0).toUpperCase() + mode.slice(1);
  const { data: demoStatus } = useDemoStatus();
  const isDemoOrg = demoStatus?.isDemoOrg ?? false;
  const vendorFlags = demoStatus?.vendorFlags;
  const vendorDisabledSummary = formatVendorDisabledSummary(vendorFlags)?.summary;

  const onToggleNotifications = () => {
    if (!user?.id || toggleDisabled) return;

    const next = { alertsEnabled: !alertsEnabled };

    setUpdateError(null);
    updatePreferences.mutate(next, {
      onError: () => {
        setUpdateError('Could not update notification preference. Please try again.');
      },
      onSuccess: () => {
        setUpdateError(null);
      },
    });
  };

  return (
    <Screen scroll={false} testID="ProfileScreen">
      <Card style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={[typography.title2, { color: colors.white }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title1, styles.title]}>{user?.name ?? 'User'}</Text>
          <Text style={[typography.body, styles.muted]} testID="profile-email">
            {user?.email ?? ''}
          </Text>
          {isDemoOrg ? <DemoModePill style={{ marginTop: spacing.xs }} /> : null}
        </View>
        <IconButton icon={<Ionicons name="settings-outline" size={20} color={colors.brandGrey} />} />
      </Card>

      {isDemoOrg ? (
        <VendorDisabledBanner vendorFlags={vendorFlags} isDemoOrg style={{ marginBottom: spacing.sm }} />
      ) : null}

      <Card style={styles.listCard}>
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandGreen} />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.body, styles.title]}>Role</Text>
              <Text style={[typography.caption, styles.muted]}>
                {roleLabel}{' '}
                <Text style={[typography.caption, styles.muted]}>
                  • Some actions may be limited by your role.
                </Text>
              </Text>
            </View>
          </View>
          <StatusPill label={roleLabel} tone="muted" />
        </View>
        <View style={styles.separator} />
        {isDemoOrg ? (
          <>
            <View style={styles.listRow} testID="demo-environment-row">
              <View style={styles.rowLeft}>
                <Ionicons name="sparkles-outline" size={18} color={colors.brandGreen} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typography.body, styles.title]}>Demo environment</Text>
              <Text style={[typography.caption, styles.muted]}>
                {vendorDisabledSummary ?? 'Sample data with limited controls for safety.'}
              </Text>
            </View>
          </View>
          <DemoModePill testID="demo-mode-pill-row" />
        </View>
        <View style={styles.separator} />
      </>
    ) : null}
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>Notifications</Text>
          </View>
          {preferencesLoading || preferencesFetching ? (
            <ActivityIndicator color={colors.brandGreen} size="small" style={{ marginRight: spacing.sm }} />
          ) : null}
          <Switch
            testID="notification-preference-toggle"
            value={alertsEnabled}
            onValueChange={onToggleNotifications}
            disabled={toggleDisabled}
            trackColor={{ false: colors.borderSubtle, true: colors.brandGreen }}
            thumbColor={colors.white}
          />
        </View>
        {notificationDenied ? (
          <View style={styles.permissionHint} testID="notification-permission-warning">
            <Text style={[typography.caption, styles.warningText]}>
              Notifications are disabled in system settings.
            </Text>
            <TouchableOpacity onPress={onOpenSettings} style={styles.settingsLink}>
              <Text style={[typography.caption, styles.title]}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {updateError ? (
          <Text
            style={[typography.caption, styles.errorText]}
            testID="notification-preference-error"
          >
            {updateError}
          </Text>
        ) : null}
        <View style={styles.separator} />
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="moon-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>Theme</Text>
          </View>
          <Text style={[typography.caption, styles.muted]} testID="profile-theme-label">
            {themeLabel}
          </Text>
        </View>
        <View style={styles.separator} />
        {showTwoFactor ? (
          <>
            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('TwoFactorSetup')}
              testID="twofactor-row"
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name={twoFactorEnabled ? 'shield-checkmark-outline' : 'shield-outline'}
                  size={18}
                  color={colors.brandGreen}
                />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typography.body, styles.title]}>Two-factor authentication</Text>
                  <Text style={[typography.caption, styles.muted]}>
                    {twoFactorEnabled
                      ? 'Authenticator app required on login.'
                      : 'Add a 6-digit code from your authenticator app.'}
                  </Text>
                </View>
              </View>
              <StatusPill label={twoFactorEnabled ? 'Enabled' : 'Disabled'} tone={twoFactorEnabled ? 'success' : 'muted'} />
            </TouchableOpacity>
            <View style={styles.separator} />
          </>
        ) : null}
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={canShare ? 0.85 : 1}
          onPress={() => {
            if (canShare) {
              navigation.navigate('Sharing');
            }
          }}
          disabled={!canShare}
          testID="sharing-row"
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="share-social-outline"
              size={18}
              color={canShare ? colors.brandGreen : colors.textSecondary}
            />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.body, styles.title]}>Sharing & access</Text>
              <Text style={[typography.caption, styles.muted]}>
                Create read-only links for sites and devices.
              </Text>
            </View>
          </View>
          <Ionicons
            name={canShare ? 'chevron-forward' : 'lock-closed-outline'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {contractorRole ? (
          <Text style={[typography.caption, styles.muted, { paddingHorizontal: spacing.lg }]}>
            Contractors can view data but cannot create share links.
          </Text>
        ) : null}
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('WorkOrders')}
          testID="workorders-row"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="clipboard-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>
              Work orders
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MaintenanceCalendar')}
          testID="maintenance-row"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="calendar-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>
              Maintenance
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Diagnostics')}
          testID="diagnostics-row"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>
              About / Diagnostics
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      <PrimaryButton label="Log out" onPress={onLogout} testID="logout-button" />
    </Screen>
  );
};

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return createThemedStyles(theme, {
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
      padding: spacing.lg,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    title: { color: colors.textPrimary },
    muted: { color: colors.textSecondary },
    listCard: {
      marginBottom: spacing.xl,
      paddingVertical: spacing.sm,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    permissionHint: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    warningText: {
      color: colors.warning,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    settingsLink: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
    },
    errorText: {
      color: colors.error,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg,
    },
    separator: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginHorizontal: spacing.lg,
    },
  });
};
