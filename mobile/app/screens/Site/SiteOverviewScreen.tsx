import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { fakeSites, getFakeDevicesForSite } from '../../api/fakeData';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'SiteOverview'>;

export const SiteOverviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { siteId } = route.params;

  const site = useMemo(() => fakeSites.find((s) => s.id === siteId), [siteId]);
  const devices = useMemo(() => getFakeDevicesForSite(siteId), [siteId]);

  if (!site) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Site not found</Text>
        <Text>The site you are looking for does not exist in the mock data.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{site.name}</Text>
        <Text>{site.city}</Text>
        <Text>Status: {site.status}</Text>
        <Text>Last seen: {new Date(site.lastSeenAt).toLocaleString()}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Devices</Text>
      <FlatList
        data={devices}
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
