import '@testing-library/jest-native/extend-expect';

const listeners: { received: Array<(notification: any) => void>; response: Array<(response: any) => void> } = {
  received: [],
  response: [],
};

beforeEach(() => {
  listeners.received.splice(0, listeners.received.length);
  listeners.response.splice(0, listeners.response.length);
});

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
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationReceivedListener: jest.fn((callback: (notification: any) => void) => {
    (listeners.received as any[]).push(callback);
    return { remove: jest.fn() };
  }),
  addNotificationResponseReceivedListener: jest.fn((callback: (response: any) => void) => {
    (listeners.response as any[]).push(callback);
    return { remove: jest.fn() };
  }),
  removeNotificationSubscription: jest.fn(),
  __listeners: listeners,
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
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
  const createNavigationContainerRef = jest.fn(() => {
    const ref: any = {
      current: {
        navigate: jest.fn(),
        isReady: jest.fn(() => true),
        getCurrentRoute: jest.fn(),
        reset: jest.fn(),
      },
      navigate: (...args: unknown[]) => ref.current.navigate(...args),
      isReady: () => true,
      getCurrentRoute: () => ref.current.getCurrentRoute(),
    };
    return ref;
  });
  const NavigationContainer = React.forwardRef(
    (
      {
        children,
        onReady,
      }: {
        children: React.ReactNode;
        onReady?: () => void;
      },
      navRef: React.MutableRefObject<any> | null
    ) => {
      React.useEffect(() => {
        if (navRef) {
          navRef.current =
            navRef.current ??
            {
              navigate: jest.fn(),
              isReady: jest.fn(() => true),
              getCurrentRoute: jest.fn(),
              reset: jest.fn(),
            };
        }
        onReady?.();
      }, [navRef, onReady]);
      return React.createElement(React.Fragment, {}, children);
    }
  );
  return {
    NavigationContainer,
    useNavigation,
    useRoute,
    createNavigationContainerRef,
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => {
      const Screen = () => null;

      const renderChild = (child: any) => {
        if (!child || !child.props) return null;

        const { component: Component, children: screenChildren, ...rest } = child.props;
        if (Component) return React.createElement(Component, rest);
        if (typeof screenChildren === 'function') return (screenChildren as Function)(rest);
        return screenChildren ?? null;
      };

      const Navigator = ({
        children,
        initialRouteName,
      }: {
        children: React.ReactNode;
        initialRouteName?: string;
      }) => {
        const childArray = React.Children.toArray(children) as any[];
        if ((global as any).__RENDER_ALL_SCREENS__) {
          return React.createElement(
            React.Fragment,
            {},
            childArray.map((child, index) => React.createElement(React.Fragment, { key: index }, renderChild(child)))
          );
        }

        const activeChild =
          (initialRouteName && childArray.find((child) => child?.props?.name === initialRouteName)) ??
          childArray[0];

        return renderChild(activeChild);
      };

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

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = (props: any) => React.createElement(View, props);
  return {
    __esModule: true,
    default: Mock,
    Circle: Mock,
    Path: Mock,
    Line: Mock,
    G: Mock,
    Defs: Mock,
    Stop: Mock,
    LinearGradient: Mock,
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

jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setButtonStyleAsync: jest.fn(),
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    useColorScheme: jest.fn(() => 'light'),
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
    VictoryArea: Mock,
    VictoryLegend: Mock,
  };
});

jest.mock('@react-native-community/netinfo', () => {
  const NetInfoStateType = {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  } as const;

  const defaultState = {
    isConnected: true,
    isInternetReachable: true,
    type: NetInfoStateType.wifi,
    details: {
      isConnectionExpensive: false,
      ssid: null,
      bssid: null,
      strength: null,
      ipAddress: null,
      subnet: null,
      frequency: null,
      linkSpeed: null,
      rxLinkSpeed: null,
      txLinkSpeed: null,
    },
  };

  return {
    NetInfoStateType,
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve(defaultState)),
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { All: 'All', Images: 'Images' },
}));

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockCameraView = ({
    onBarcodeScanned,
    testID,
  }: {
    onBarcodeScanned?: (event: any) => void;
    testID?: string;
  }) =>
    React.createElement(View, {
      testID: testID ?? 'mock-camera-view',
      onTouchEnd: () => onBarcodeScanned?.({ data: 'mock-code' }),
      style: { flex: 1 },
    });

  return {
    CameraView: MockCameraView,
    Camera: {
      requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
      getCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    },
  };
});

jest.mock('./app/api/demo/hooks', () => {
  const actual = jest.requireActual('./app/api/demo/hooks');
  const defaultStatus = {
    isDemoOrg: false,
    heroDeviceId: null,
    heroDeviceMac: null,
    seededAt: null,
    vendorFlags: {
      disabled: [],
      prodLike: false,
      mqttDisabled: false,
      controlDisabled: false,
      heatPumpHistoryDisabled: false,
      pushDisabled: false,
      pushNotificationsDisabled: false,
    },
  };
  return {
    ...actual,
    useDemoStatus: jest.fn(() => ({ data: defaultStatus })),
    DEMO_STATUS_QUERY_KEY: actual.DEMO_STATUS_QUERY_KEY,
  };
});
