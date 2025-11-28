import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceTelemetry,
  useModeCommand,
  useSetpointCommand,
  useSite,
} from '../../api/hooks';
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

  const setpointMutation = useSetpointCommand(deviceId);
  const modeMutation = useModeCommand(deviceId);

  const [setpointInput, setSetpointInput] = useState('45');
  const [selectedMode, setSelectedMode] = useState<'OFF' | 'HEATING' | 'COOLING' | 'AUTO'>(
    'HEATING'
  );

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

  const onSetpointSave = async () => {
    const value = Number(setpointInput);
    if (Number.isNaN(value)) {
      Alert.alert('Invalid value', 'Please enter a number');
      return;
    }

    try {
      await setpointMutation.mutateAsync(value);
      Alert.alert('Success', `Setpoint updated to ${value}C`);
    } catch (e) {
      Alert.alert('Error', 'Failed to update setpoint');
    }
  };

  const onModeChange = async (mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') => {
    setSelectedMode(mode);
    try {
      await modeMutation.mutateAsync(mode);
      Alert.alert('Success', `Mode changed to ${mode}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to change mode');
    }
  };

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

      <View style={{ marginTop: 24, paddingVertical: 8, borderTopWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Controls</Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 4 }}>Flow temperature setpoint (C)</Text>
          <TextInput
            value={setpointInput}
            onChangeText={setSetpointInput}
            keyboardType='numeric'
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              padding: 8,
              borderRadius: 6,
              marginBottom: 8,
              maxWidth: 120,
            }}
          />
          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Allowed range: 30-60C</Text>
          <Button
            title={setpointMutation.isLoading ? 'Updating...' : 'Update setpoint'}
            onPress={onSetpointSave}
            disabled={setpointMutation.isLoading}
          />
        </View>

        <View>
          <Text style={{ marginBottom: 8 }}>Mode</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(['OFF', 'HEATING', 'COOLING', 'AUTO'] as const).map((mode) => {
              const selected = selectedMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => onModeChange(mode)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selected ? '#0f766e' : '#d1d5db',
                    backgroundColor: selected ? '#0f766e' : '#fff',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                  disabled={modeMutation.isLoading}
                >
                  <Text
                    style={{
                      color: selected ? '#fff' : '#111827',
                      fontWeight: selected ? '600' : '400',
                    }}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
