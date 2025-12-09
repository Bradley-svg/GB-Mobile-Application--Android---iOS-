import React from 'react';
import { View, Text, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../api/client';
import { useCreateShareLink, useRevokeShareLink, useShareLinks } from '../../api/shareLinks/hooks';
import { Screen, Card, EmptyState, ErrorCard } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { createThemedStyles } from '../../theme/createThemedStyles';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'ShareLinks'>;

const PRESETS = [
  { label: '24 hours', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

export const ShareLinksScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const params = route.params ?? {};
  const scope = params?.scope;
  const id = params?.id ?? '';
  const resolvedScope: 'site' | 'device' = scope === 'device' ? 'device' : 'site';
  const hasValidParams = scope === 'site' ? !!id : scope === 'device' ? !!id : false;
  const name = params?.name ?? 'Shared item';
  const { isOffline } = useNetworkBanner();
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const linksQuery = useShareLinks(resolvedScope, id);
  const createLink = useCreateShareLink();
  const revokeLink = useRevokeShareLink();

  const handleCreate = (days: number) => {
    if (isOffline || createLink.isPending) return;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    createLink.mutate({ scope: resolvedScope, id, expiresAt });
  };

  const handleCopy = async (token: string) => {
    const url = `${API_BASE_URL}/public/share/${token}`;
    await Share.share({ message: url });
  };

  const handleRevoke = (linkId: string) => {
    if (isOffline || revokeLink.isPending) return;
    revokeLink.mutate({ linkId, scope: resolvedScope, scopeId: id });
  };

  const isLoading = linksQuery.isLoading;
  const links = linksQuery.data || [];

  if (!hasValidParams) {
    return (
      <Screen scroll testID="ShareLinksScreen" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <ErrorCard
          title="Missing sharing context"
          message="Select a site or device to manage share links."
          testID="share-links-missing"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll testID="ShareLinksScreen" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.brandGrey} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, styles.muted]}>{resolvedScope === 'site' ? 'Site' : 'Device'}</Text>
          <Text style={[typography.title2, styles.title]} numberOfLines={2}>
            {name}
          </Text>
        </View>
      </View>

      <Card style={styles.infoCard}>
        <Text style={[typography.subtitle, styles.title]}>Share links</Text>
        <Text style={[typography.body, styles.muted, { marginTop: spacing.xs }]}>
          Links are read-only and expire automatically. Revoke any link to disable access instantly.
        </Text>
        {isOffline ? (
          <Text style={[typography.caption, styles.warning]}>
            Offline - creating or revoking links is disabled.
          </Text>
        ) : null}
      </Card>

      <Text style={[typography.subtitle, styles.sectionTitle]}>Create new</Text>
      <View style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            onPress={() => handleCreate(preset.days)}
            disabled={isOffline || createLink.isPending}
            style={[
              styles.presetButton,
              isOffline || createLink.isPending ? styles.buttonDisabled : styles.buttonEnabled,
            ]}
            testID="create-share-link"
          >
            <Ionicons name="time-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, marginLeft: spacing.xs }]}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.subtitle, styles.sectionTitle]}>Active links</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.brandGreen} style={{ marginVertical: spacing.md }} />
      ) : null}
      {!isLoading && links.length === 0 ? (
        <EmptyState message="No active share links yet." testID="share-links-empty" />
      ) : null}

      {links.map((link) => (
        <Card key={link.id} style={styles.linkCard} testID="share-link-row">
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, styles.title]}>
              Expires {new Date(link.expiresAt).toLocaleString()}
            </Text>
            {link.createdBy?.name || link.createdBy?.email ? (
              <Text style={[typography.caption, styles.muted]}>
                Created by {link.createdBy?.name || link.createdBy?.email}
              </Text>
            ) : null}
            <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
              Token: {link.token}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleCopy(link.token)}
              style={[styles.iconButton, styles.copyButton]}
              testID="copy-share-link"
            >
              <Ionicons name="copy-outline" size={16} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRevoke(link.id)}
              disabled={isOffline || revokeLink.isPending}
              style={[
                styles.iconButton,
                isOffline || revokeLink.isPending ? styles.buttonDisabled : styles.revokeButton,
              ]}
              testID="revoke-share-link"
            >
              <Ionicons name="trash-outline" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Card>
      ))}
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    backButton: {
      marginRight: theme.spacing.sm,
      padding: theme.spacing.xs,
    },
    infoCard: {
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    muted: { color: theme.colors.textSecondary },
    title: { color: theme.colors.textPrimary },
    warning: { color: theme.colors.warning, marginTop: theme.spacing.xs },
    sectionTitle: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      color: theme.colors.textPrimary,
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    presetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginRight: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    buttonEnabled: {
      backgroundColor: theme.colors.brandGreen,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.borderSubtle,
    },
    linkCard: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      padding: theme.spacing.sm,
      borderRadius: 12,
      marginLeft: theme.spacing.xs,
    },
    copyButton: {
      backgroundColor: theme.colors.brandGreen,
    },
    revokeButton: {
      backgroundColor: theme.colors.error,
    },
  });
