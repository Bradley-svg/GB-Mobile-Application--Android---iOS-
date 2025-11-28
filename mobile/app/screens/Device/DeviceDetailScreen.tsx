import React, { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Button, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevice, useDeviceAlerts, useDeviceTelemetry, useSite } from '../../api/hooks';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { deviceId } = route.params;
  const [range, setRange] = useState<'24h' | '7d'>('24h');

  const { data: device, isLoading, isError } = useDevice(deviceId);
  const siteId = device?.site_id;
  const { data: site } = useSite(siteId || '');
  const { data: deviceAlerts } = useDeviceAlerts(deviceId);
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    isError: telemetryError,
  } = useDeviceTelemetry(deviceId, range);

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

  const supplyPoints = telemetry?.metrics['supply_temp'] || [];
  const returnPoints = telemetry?.metrics['return_temp'] || [];
  const powerPoints = telemetry?.metrics['power_kw'] || [];

  const activeDeviceAlerts = (deviceAlerts || []).filter((a) => a.status === 'active');

  const supplyData = supplyPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const returnData = returnPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const powerData = powerPoints.map((p, idx) => ({ x: idx, y: p.value }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{device.name}</Text>
      <Text>Type: {device.type}</Text>
      <Text>Status: {device.status}</Text>
      <Text>
        Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Unknown'}
      </Text>
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '600' }}>Site</Text>
        <Text>{siteName}</Text>
        {site?.city ? <Text>{site.city}</Text> : null}
      </View>

      {activeDeviceAlerts.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 4 }}>Active alerts</Text>
          {activeDeviceAlerts.map((a) => (
            <Text key={a.id} style={{ color: '#b91c1c' }}>
              - [{a.severity.toUpperCase()}] {a.message}
            </Text>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', marginVertical: 16 }}>
        <Button
          title="24h"
          onPress={() => setRange('24h')}
          color={range === '24h' ? '#007aff' : undefined}
        />
        <View style={{ width: 8 }} />
        <Button
          title="7d"
          onPress={() => setRange('7d')}
          color={range === '7d' ? '#007aff' : undefined}
        />
      </View>

      {telemetryLoading && (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 4 }}>Loading telemetry...</Text>
        </View>
      )}

      {telemetryError && !telemetryLoading ? (
        <Text style={{ color: 'red' }}>Failed to load telemetry.</Text>
      ) : null}

      {!telemetryLoading && !telemetryError && (
        <View>
          <Text style={{ marginBottom: 8, fontWeight: '600' }}>Flow temperatures (C)</Text>
          {supplyData.length > 0 || returnData.length > 0 ? (
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLegend
                x={40}
                y={0}
                orientation="horizontal"
                gutter={20}
                data={[
                  { name: 'Supply', symbol: { fill: 'tomato' } },
                  { name: 'Return', symbol: { fill: 'steelblue' } },
                ]}
              />
              <VictoryLine data={supplyData} style={{ data: { stroke: 'tomato' } }} />
              <VictoryLine data={returnData} style={{ data: { stroke: 'steelblue' } }} />
            </VictoryChart>
          ) : (
            <Text>No temperature telemetry for this range.</Text>
          )}

          <View style={{ height: 24 }} />

          <Text style={{ marginBottom: 8, fontWeight: '600' }}>Power (kW)</Text>
          {powerData.length > 0 ? (
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={powerData} style={{ data: { stroke: 'green' } }} />
            </VictoryChart>
          ) : (
            <Text>No power telemetry for this range.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};
