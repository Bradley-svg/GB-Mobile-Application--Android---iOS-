import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';
import { typography } from '../theme/typography';
import { isContractor, useAuthStore } from '../store/authStore';

type Props = {
  action: string;
  allowedRoles?: string[];
  roleOverride?: string | null;
  visible?: boolean;
  testID?: string;
};

export const RoleRestrictedHint: React.FC<Props> = ({
  action,
  allowedRoles,
  roleOverride,
  visible = true,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const effectiveRole = roleOverride ?? role;
  const contractor = isContractor(effectiveRole);
  const blockedByAllowedRoles =
    allowedRoles && effectiveRole ? !allowedRoles.includes(effectiveRole) : false;

  if (!visible || (!contractor && !blockedByAllowedRoles)) return null;

  const roleLabel = contractor ? 'Contractor accounts' : 'Your role';
  const allowedLabel = allowedRoles?.join(' or ');

  return (
    <View style={styles.container} testID={testID}>
      <Ionicons name="lock-closed-outline" size={14} color={theme.colors.warning} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, styles.text]}>
          {contractor
            ? `${roleLabel} cannot ${action}.`
            : `${roleLabel} cannot ${action}${allowedLabel ? ` (requires ${allowedLabel})` : ''}.`}
        </Text>
        <Text style={[typography.caption, styles.subtle]}>
          Contact an admin or owner for access.
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.warningBackground,
      borderWidth: 1,
      borderColor: theme.colors.warningBorder,
      marginTop: theme.spacing.xs,
    },
    icon: {
      marginRight: theme.spacing.xs,
      marginTop: theme.spacing.xs / 2,
    },
    text: {
      color: theme.colors.textPrimary,
    },
    subtle: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs / 2,
    },
  });
