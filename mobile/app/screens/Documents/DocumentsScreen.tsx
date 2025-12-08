import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDeviceDocuments, useSiteDocuments, useSignedFileUrl } from '../../api/hooks';
import type { Document } from '../../api/documents/types';
import { Screen, Card, IconButton, StatusPill, EmptyState, ErrorCard } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { api, shouldUseSignedFileUrls } from '../../api/client';

type Route = RouteProp<AppStackParamList, 'Documents'>;
type Navigation = NativeStackNavigationProp<AppStackParamList>;

const buildDocumentUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = api.defaults.baseURL || '';
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
};

const categoryTone = (category?: string) => {
  if (!category) return 'muted' as const;
  const normalized = category.toLowerCase();
  if (normalized.includes('manual')) return 'success' as const;
  if (normalized.includes('schematic') || normalized.includes('drawing')) return 'warning' as const;
  return 'muted' as const;
};

export const DocumentsScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const scope = route.params.scope;
  const siteId = route.params.siteId;
  const deviceId = route.params.deviceId;
  const { isOffline } = useNetworkBanner();

  const siteDocuments = useSiteDocuments(siteId || '');
  const deviceDocuments = useDeviceDocuments(deviceId || '');
  const signedFileUrl = useSignedFileUrl();
  const query = scope === 'site' ? siteDocuments : deviceDocuments;

  const documents = query.data ?? [];
  const cachedLabel = useMemo(() => {
    if (!query.dataUpdatedAt) return null;
    return new Date(query.dataUpdatedAt).toLocaleTimeString();
  }, [query.dataUpdatedAt]);

  const openDocument = async (doc: Document) => {
    let target = buildDocumentUrl(doc.url);
    if (shouldUseSignedFileUrls()) {
      try {
        const signedUrl = await signedFileUrl.mutateAsync(doc.id);
        target = buildDocumentUrl(signedUrl);
      } catch (err) {
        console.error('Failed to open document', err);
        return;
      }
    }
    if (!target) return;
    try {
      await Linking.openURL(target);
    } catch (err) {
      console.error('Failed to open document', err);
    }
  };

  const title =
    route.params.title ||
    (scope === 'site' ? 'Site documents' : scope === 'device' ? 'Device documents' : 'Documents');

  const showLoading = query.isLoading && documents.length === 0;
  const showError = query.isError && documents.length === 0;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="DocumentsScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="documents-back-button"
        />
        <Text style={[typography.subtitle, styles.title]}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isOffline && documents.length > 0 ? (
        <StatusPill
          label={`Read-only cached documents${cachedLabel ? ` (${cachedLabel})` : ''}`}
          tone="muted"
          style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}
          testID="documents-offline-banner"
        />
      ) : null}

      {showLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandGreen} />
          <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading documents...</Text>
        </View>
      ) : showError ? (
        <ErrorCard
          title="Couldn't load documents"
          message="Check your connection and try again."
          onRetry={() => query.refetch()}
          testID="documents-error"
        />
      ) : documents.length === 0 ? (
        <EmptyState
          message={isOffline ? 'Offline and no cached documents available yet.' : 'No documents uploaded yet.'}
          testID="documents-empty"
        />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <Card style={styles.documentCard} onPress={() => openDocument(item)} testID="document-row">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.docIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.brandGreen} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={[typography.caption, styles.muted]}>
                    {item.originalName || item.title}
                    {item.sizeBytes ? ` • ${(item.sizeBytes / 1024).toFixed(1)} KB` : ''}
                  </Text>
                </View>
                <StatusPill label={item.category || 'other'} tone={categoryTone(item.category)} />
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginLeft: spacing.sm }}
                />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  documentCard: {
    marginBottom: spacing.sm,
  },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
