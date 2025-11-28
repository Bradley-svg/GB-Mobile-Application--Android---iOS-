import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fakeSites } from '../../api/fakeData';
import { AppStackParamList } from '../../navigation/RootNavigator';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={fakeSites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              borderWidth: 1,
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
            }}
            onPress={() => navigation.navigate('SiteOverview', { siteId: item.id })}
          >
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text>{item.city}</Text>
            <Text>Status: {item.status}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
