import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSites } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { theme } from '../../theme/theme';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError } = useSites();

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading sites...</Text>
      </View>
    );
  }

  if (isError) {
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
          Failed to load sites
        </Text>
        <Text style={{ color: theme.colors.mutedText }}>Check your connection and try again.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <FlatList
        data={data || []}
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
            onPress={() => navigation.navigate('SiteOverview', { siteId: item.id })}
          >
            <Text style={{ fontWeight: '600', color: theme.colors.text }}>{item.name}</Text>
            <Text style={{ color: theme.colors.mutedText }}>{item.city}</Text>
            <Text style={{ color: theme.colors.text }}>Status: {item.status}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
