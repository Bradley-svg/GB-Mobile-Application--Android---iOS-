import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAlerts } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { theme } from '../../theme/theme';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return '#e11d48';
    case 'warning':
      return '#facc15';
    default:
      return '#0ea5e9';
  }
};

export const AlertsScreen: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'warning' | 'critical'>('all');
  const { data: alerts, isLoading } = useAlerts({
    status: 'active',
    severity: severityFilter === 'all' ? undefined : severityFilter,
  });

  const navigation = useNavigation<Navigation>();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const sortedAlerts = (alerts || []).slice().sort((a, b) => {
    const sA = SEVERITY_ORDER[a.severity] ?? 99;
    const sB = SEVERITY_ORDER[b.severity] ?? 99;
    if (sA !== sB) return sA - sB;
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
  });

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <View style={styles.filterRow}>
        {['all', 'warning', 'critical'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, severityFilter === s && styles.filterChipActive]}
            onPress={() => setSeverityFilter(s as any)}
          >
            <Text style={{ color: severityFilter === s ? '#fff' : '#000' }}>{s.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sortedAlerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => navigation.navigate('AlertDetail', { alertId: item.id })}
          >
            <View style={[styles.severityDot, { backgroundColor: severityColor(item.severity) }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: theme.colors.text }}>{item.message}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.mutedText }}>
                {item.type.toUpperCase()} | {new Date(item.last_seen_at).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: theme.colors.mutedText }}>No active alerts yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    backgroundColor: theme.colors.card,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
});
