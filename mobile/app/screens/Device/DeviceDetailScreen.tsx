import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevice, useSite } from '../../api/hooks';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { deviceId } = route.params;

  const { data: device, isLoading, isError } = useDevice(deviceId);
  const siteId = device?.site_id;
  const { data: site } = useSite(siteId || '');

  const siteName = useMemo(() => site?.name || 'Unknown site', [site]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading device...</Text>
      </View>
    );
  }

  if (isError || !device) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Device not found</Text>
        <Text>The device you are looking for could not be retrieved.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{device.name}</Text>
      <Text>Type: {device.type}</Text>
      <Text>Status: {device.status}</Text>
      <Text>Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Unknown'}</Text>
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '600' }}>Site</Text>
        <Text>{siteName}</Text>
        {site?.city ? <Text>{site.city}</Text> : null}
      </View>
    </View>
  );
};
