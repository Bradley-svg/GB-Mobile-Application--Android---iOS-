import React from 'react';
import { ActivityIndicator, Alert, Button, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAcknowledgeAlert, useAlerts, useMuteAlert } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';

type AlertDetailRouteParams = RouteProp<AppStackParamList, 'AlertDetail'>;

export const AlertDetailScreen: React.FC = () => {
  const route = useRoute<AlertDetailRouteParams>();
  const alertId = route.params.alertId;
  const navigation = useNavigation<any>();

  const { data: alerts, isLoading } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const mute = useMuteAlert();

  if (isLoading || !alerts) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const alertItem = alerts.find((a) => a.id === alertId);
  if (!alertItem) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Alert not found</Text>
      </View>
    );
  }

  const onAcknowledge = async () => {
    try {
      await acknowledge.mutateAsync(alertItem.id);
      Alert.alert('Acknowledged', 'Alert marked as acknowledged');
    } catch (e) {
      Alert.alert('Error', 'Failed to acknowledge alert');
    }
  };

  const onMute = async () => {
    try {
      await mute.mutateAsync({ alertId: alertItem.id, minutes: 60 });
      Alert.alert('Muted', 'Alert muted for 60 minutes');
    } catch (e) {
      Alert.alert('Error', 'Failed to mute alert');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Alert detail</Text>
      <Text style={{ marginBottom: 4 }}>Type: {alertItem.type}</Text>
      <Text style={{ marginBottom: 4 }}>Severity: {alertItem.severity}</Text>
      <Text style={{ marginBottom: 4 }}>Status: {alertItem.status}</Text>
      <Text style={{ marginBottom: 4 }}>Message: {alertItem.message}</Text>
      <Text style={{ marginBottom: 4 }}>
        First seen: {new Date(alertItem.first_seen_at).toLocaleString()}
      </Text>
      <Text style={{ marginBottom: 16 }}>
        Last seen: {new Date(alertItem.last_seen_at).toLocaleString()}
      </Text>

      <Button title="Acknowledge" onPress={onAcknowledge} />
      <View style={{ height: 8 }} />
      <Button title="Mute for 60 minutes" onPress={onMute} />
      <View style={{ height: 16 }} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
};
