import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { fakeSites, getFakeDevice } from '../../api/fakeData';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { deviceId } = route.params;

  const device = useMemo(() => getFakeDevice(deviceId), [deviceId]);
  const site = useMemo(() => fakeSites.find((s) => s.id === device?.siteId), [device]);

  if (!device) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Device not found</Text>
        <Text>The device you are looking for does not exist in the mock data.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{device.name}</Text>
      <Text>Type: {device.type}</Text>
      <Text>Status: {device.status}</Text>
      <Text>Last seen: {new Date(device.lastSeenAt).toLocaleString()}</Text>
      {site ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '600' }}>Site</Text>
          <Text>{site.name}</Text>
          <Text>{site.city}</Text>
        </View>
      ) : null}
    </View>
  );
};
