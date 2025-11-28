import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevices, useSite } from '../../api/hooks';
import { theme } from '../../theme/theme';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'SiteOverview'>;

export const SiteOverviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { siteId } = route.params;

  const { data: site, isLoading: siteLoading, isError: siteError } = useSite(siteId);
  const { data: devices, isLoading: devicesLoading, isError: devicesError } = useDevices(siteId);

  if (siteLoading || devicesLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading site...</Text>
      </View>
    );
  }

  if (siteError || devicesError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: theme.colors.text }}>
          Failed to load site
        </Text>
        <Text style={{ color: theme.colors.mutedText }}>Please check your connection and try again.</Text>
      </View>
    );
  }

  if (!site) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: theme.colors.text }}>
          Site not found
        </Text>
        <Text style={{ color: theme.colors.mutedText }}>The site you are looking for could not be found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>{site.name}</Text>
        <Text style={{ color: theme.colors.mutedText }}>{site.city}</Text>
        <Text style={{ color: theme.colors.text }}>Status: {site.status}</Text>
        <Text style={{ color: theme.colors.mutedText }}>
          Last seen: {site.last_seen_at ? new Date(site.last_seen_at).toLocaleString() : 'Unknown'}
        </Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: theme.colors.text }}>Devices</Text>
      <FlatList
        data={devices || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              borderWidth: 1,
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            }}
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
          >
            <Text style={{ fontWeight: '600', color: theme.colors.text }}>{item.name}</Text>
            <Text style={{ color: theme.colors.mutedText }}>Type: {item.type}</Text>
            <Text style={{ color: theme.colors.text }}>Status: {item.status}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: theme.colors.mutedText }}>No devices available.</Text>}
      />
    </View>
  );
};
