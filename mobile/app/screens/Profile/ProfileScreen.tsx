import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, TouchableOpacity, View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Screen, Card, PrimaryButton, IconButton } from '../../components';
import { getNotificationPermissionStatus } from '../../hooks/useRegisterPushToken';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../../api/preferences/hooks';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const ProfileScreen: React.FC = () => {
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
        </View>
        <IconButton icon={<Ionicons name="settings-outline" size={20} color={colors.brandGrey} />} />
      </Card>

      <Card style={styles.listCard}>
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
          <Text style={[typography.caption, styles.muted]}>Light</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>About</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </Card>

      <PrimaryButton label="Log out" onPress={onLogout} testID="logout-button" />
    </Screen>
  );
};

const styles = StyleSheet.create({
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
