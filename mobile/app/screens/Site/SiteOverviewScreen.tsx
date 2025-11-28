import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevices, useSite } from '../../api/hooks';

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading site...</Text>
      </View>
    );
  }

  if (siteError || devicesError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Failed to load site</Text>
        <Text>Please check your connection and try again.</Text>
      </View>
    );
  }

  if (!site) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Site not found</Text>
        <Text>The site you are looking for could not be found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{site.name}</Text>
        <Text>{site.city}</Text>
        <Text>Status: {site.status}</Text>
        <Text>Last seen: {site.last_seen_at ? new Date(site.last_seen_at).toLocaleString() : 'Unknown'}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Devices</Text>
      <FlatList
        data={devices || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ borderWidth: 1, padding: 12, marginBottom: 8, borderRadius: 8 }}
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
          >
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text>Type: {item.type}</Text>
            <Text>Status: {item.status}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No devices available.</Text>}
      />
    </View>
  );
};
