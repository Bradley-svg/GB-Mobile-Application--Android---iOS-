import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Screen, Card, PrimaryButton, IconButton } from '../../theme/components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const ProfileScreen: React.FC = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const initials = useMemo(() => {
    const name = user?.name || 'G B';
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [user?.name]);

  const onLogout = async () => {
    await clearAuth();
  };

  return (
    <Screen scroll={false}>
      <Card style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={[typography.title2, { color: colors.white }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title1, styles.title]}>{user?.name ?? 'User'}</Text>
          <Text style={[typography.body, styles.muted]}>{user?.email ?? ''}</Text>
        </View>
        <IconButton icon={<Ionicons name="settings-outline" size={20} color={colors.dark} />} />
      </Card>

      <Card style={styles.listCard}>
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>Notifications</Text>
          </View>
          <View style={styles.toggleShell}>
            <View style={styles.toggleThumb} />
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="moon-outline" size={18} color={colors.primary} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>Theme</Text>
          </View>
          <Text style={[typography.caption, styles.muted]}>Light</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.listRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={[typography.body, styles.title, { marginLeft: spacing.sm }]}>About</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Card>

      <PrimaryButton label="Log out" onPress={onLogout} />
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { color: colors.dark },
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
  toggleShell: {
    width: 44,
    height: 26,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xs,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignSelf: 'flex-end',
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginHorizontal: spacing.lg,
  },
});
