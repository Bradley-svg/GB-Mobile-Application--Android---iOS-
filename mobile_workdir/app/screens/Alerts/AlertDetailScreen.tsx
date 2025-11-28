import React from 'react';
import { ActivityIndicator, Alert, Button, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAcknowledgeAlert, useAlerts, useMuteAlert } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { theme } from '../../theme/theme';

type AlertDetailRouteParams = RouteProp<AppStackParamList, 'AlertDetail'>;

export const AlertDetailScreen: React.FC = () => {
  const route = useRoute<AlertDetailRouteParams>();
  const alertId = route.params.alertId;
  const navigation = useNavigation<any>();

  const { data: alerts, isLoading, isError } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const mute = useMuteAlert();

  if (isLoading || !alerts) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text, fontWeight: '600', marginBottom: 4 }}>
          Failed to load alert
        </Text>
        <Text style={{ color: theme.colors.mutedText }}>Please try again.</Text>
      </View>
    );
  }

  const alertItem = alerts.find((a) => a.id === alertId);
  if (!alertItem) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Alert not found</Text>
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
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8, color: theme.colors.text }}>
        Alert detail
      </Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Type: {alertItem.type}</Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Severity: {alertItem.severity}</Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Status: {alertItem.status}</Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Message: {alertItem.message}</Text>
      <Text style={{ marginBottom: 4, color: theme.colors.mutedText }}>
        First seen: {new Date(alertItem.first_seen_at).toLocaleString()}
      </Text>
      <Text style={{ marginBottom: 16, color: theme.colors.mutedText }}>
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
