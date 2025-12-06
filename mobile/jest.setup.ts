import '@testing-library/jest-native/extend-expect';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'push-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  removeNotificationSubscription: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiUrl: 'http://localhost:4000', eas: { projectId: 'test-project' } } },
  easConfig: { projectId: 'test-project' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const useNavigation = jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() }));
  const useRoute = jest.fn(() => ({ params: {} }));
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, {}, children),
    useNavigation,
    useRoute,
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => {
      const Screen = ({
        component: Component,
        children,
        ...rest
      }: {
        component?: React.ComponentType<any>;
        children?: React.ReactNode;
      }) => {
        if (Component) return React.createElement(Component, rest);
        if (typeof children === 'function') return (children as Function)(rest);
        return children ?? null;
      };
      const Navigator = ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, {}, children);
      return { Navigator, Screen };
    },
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  return {
    createBottomTabNavigator: () => {
      const Screen = ({
        component: Component,
        children,
        ...rest
      }: {
        component?: React.ComponentType<any>;
        children?: React.ReactNode;
      }) => {
        if (Component) return React.createElement(Component, rest);
        if (typeof children === 'function') return (children as Function)(rest);
        return children ?? null;
      };
      const Navigator = ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, {}, children);
      return { Navigator, Screen };
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name?: string }) => React.createElement(Text, {}, name ?? 'icon');
  return {
    Ionicons: Icon,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style }: { children?: React.ReactNode; style?: any }) =>
      React.createElement(View, { style }, children),
  };
});

jest.mock('victory-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, {}, children);

  return {
    VictoryChart: Mock,
    VictoryLine: Mock,
    VictoryAxis: Mock,
    VictoryLegend: Mock,
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      details: null,
      type: 'wifi',
    })
  ),
}));
