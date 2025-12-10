import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';
import { SkeletonPlaceholder } from './SkeletonPlaceholder';

type Props = {
  rows?: number;
  testID?: string;
};

export const ListSkeleton: React.FC<Props> = ({ rows = 3, testID }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { spacing } = theme;

  return (
    <View style={styles.container} testID={testID}>
      {Array.from({ length: rows }).map((_, idx) => (
        <View
          key={idx}
          style={[styles.card, idx === rows - 1 ? { marginBottom: 0 } : null]}
          testID="list-skeleton-row"
        >
          <View style={styles.rowTop}>
            <SkeletonPlaceholder width={36} height={12} style={{ marginRight: spacing.sm }} />
            <SkeletonPlaceholder width="55%" height={14} />
          </View>
          <SkeletonPlaceholder width="80%" height={12} style={{ marginTop: spacing.xs }} />
          <SkeletonPlaceholder width="40%" height={10} style={{ marginTop: spacing.xs }} />
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      width: '100%',
    },
    card: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });
