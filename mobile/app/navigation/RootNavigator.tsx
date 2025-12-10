import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/Auth/ResetPasswordScreen';
import { TwoFactorScreen } from '../screens/Auth/TwoFactorScreen';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { AlertsScreen } from '../screens/Alerts/AlertsScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SiteOverviewScreen } from '../screens/Site/SiteOverviewScreen';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import { AlertDetailScreen } from '../screens/Alerts/AlertDetailScreen';
import { DiagnosticsScreen } from '../screens/Profile/DiagnosticsScreen';
import { SearchScreen } from '../screens/Search/SearchScreen';
import { WorkOrdersScreen } from '../screens/WorkOrders/WorkOrdersScreen';
import { WorkOrderDetailScreen } from '../screens/WorkOrders/WorkOrderDetailScreen';
import { MaintenanceCalendarScreen } from '../screens/Maintenance/MaintenanceCalendarScreen';
import { DocumentsScreen } from '../screens/Documents/DocumentsScreen';
import { SharingScreen } from '../screens/Profile/SharingScreen';
import { ShareLinksScreen } from '../screens/Sharing/ShareLinksScreen';
import { TwoFactorSetupScreen } from '../screens/Profile/TwoFactorSetupScreen';
import { typography } from '../theme/typography';
import { useAppTheme } from '../theme/useAppTheme';
import { createSurfaceStyles } from '../components';
import GreenbroLogo from '../../assets/greenbro/greenbro-logo-horizontal.png';

const GreenbroHeaderLogo: React.FC = () => (
  <Image
    source={GreenbroLogo}
    style={{ width: 160, height: 44 }}
    resizeMode="contain"
    accessibilityLabel="Greenbro logo"
  />
);

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: { resetSuccessMessage?: string } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  TwoFactor: { challengeToken: string; email: string };
};

export type AppStackParamList = {
  Tabs: undefined;
  SiteOverview: { siteId: string };
  DeviceDetail: { deviceId: string };
  AlertDetail: { alertId: string };
  Diagnostics: undefined;
  Search: undefined;
  WorkOrders: undefined;
  WorkOrderDetail: { workOrderId: string };
  MaintenanceCalendar: undefined;
  Documents: { scope: 'site' | 'device'; siteId?: string; deviceId?: string; title?: string };
  Sharing: undefined;
  ShareLinks: { scope: 'site' | 'device'; id: string; name: string };
  TwoFactorSetup: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Alerts: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const tabButton = (testID: string) => {
  const Button: React.FC<BottomTabBarButtonProps> = (props) => (
    <TouchableOpacity {...props} testID={testID} accessibilityLabel={testID} />
  );
  Button.displayName = `TabButton-${testID}`;
  return Button;
};

function AuthNavigator() {
  const { theme } = useAppTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="TwoFactor" component={TwoFactorScreen} />
    </AuthStack.Navigator>
  );
}

function AppTabs() {
  const { theme } = useAppTheme();
  const surface = useMemo(() => createSurfaceStyles(theme), [theme]);
  const spacing = theme.spacing;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          height: 90,
          paddingBottom: spacing.md,
        },
        tabBarActiveTintColor: theme.colors.brandGreen,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { ...typography.caption, marginBottom: spacing.xs },
        tabBarItemStyle: { height: 70 },
        tabBarBackground: () => (
          <View
            style={{
              position: 'absolute',
              left: spacing.lg,
              right: spacing.lg,
              bottom: spacing.md,
              height: 68,
              borderRadius: 28,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.borderSubtle,
              ...surface.shadow,
            }}
          />
        ),
        tabBarIcon: ({ color, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'grid-outline';
          if (route.name === 'Alerts') {
            iconName = focused ? 'alert' : 'alert-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  padding: focused ? spacing.md : spacing.sm,
                  borderRadius: 16,
                  backgroundColor: focused ? theme.colors.brandSoft : theme.colors.backgroundAlt,
                  borderWidth: focused ? 0 : 1,
                  borderColor: theme.colors.borderSubtle,
                }}
              >
                <Ionicons name={iconName} size={22} color={focused ? theme.colors.brandGreen : color} />
              </View>
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarTestID: 'tab-dashboard',
          tabBarButton: tabButton('tab-dashboard'),
          headerShown: true,
          headerTitle: () => <GreenbroHeaderLogo />,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarTestID: 'tab-alerts',
          tabBarButton: tabButton('tab-alerts'),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarTestID: 'tab-profile',
          tabBarButton: tabButton('tab-profile'),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { theme } = useAppTheme();
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <AppStack.Screen name="Tabs" component={AppTabs} />
      <AppStack.Screen name="SiteOverview" component={SiteOverviewScreen} />
      <AppStack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
      <AppStack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <AppStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
      <AppStack.Screen name="Search" component={SearchScreen} />
      <AppStack.Screen name="WorkOrders" component={WorkOrdersScreen} />
      <AppStack.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} />
      <AppStack.Screen name="MaintenanceCalendar" component={MaintenanceCalendarScreen} />
      <AppStack.Screen name="Documents" component={DocumentsScreen} />
      <AppStack.Screen name="Sharing" component={SharingScreen} />
      <AppStack.Screen name="ShareLinks" component={ShareLinksScreen} />
      <AppStack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
    </AppStack.Navigator>
  );
}

interface RootNavigatorProps {
  isAuthenticated: boolean;
  sessionExpired?: boolean;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({ isAuthenticated, sessionExpired }) => {
  console.log('RootNavigator: rendering', {
    stack: isAuthenticated ? 'App' : 'Auth',
  });
  const { theme, resolvedScheme } = useAppTheme();
  const spacing = theme.spacing;
  const navigationTheme = useMemo(
    () => ({
      dark: resolvedScheme === 'dark',
      colors: {
        background: theme.colors.background,
        card: theme.colors.card,
        primary: theme.colors.brandGreen,
        text: theme.colors.textPrimary,
        border: theme.colors.borderSubtle,
        notification: theme.colors.error,
      },
    }),
    [resolvedScheme, theme]
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <RootStack.Screen name="Auth">
            {() => (
              <View style={{ flex: 1 }}>
                {sessionExpired ? (
                  <View
                    style={{
                      backgroundColor: theme.colors.backgroundAlt,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderBottomWidth: 1,
                      borderColor: theme.colors.borderSubtle,
                    }}
                  >
                    <Text style={[typography.caption, { color: theme.colors.textPrimary }]}>
                      Your session has expired. Please log in again.
                    </Text>
                  </View>
                ) : null}
                <AuthNavigator />
              </View>
            )}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
