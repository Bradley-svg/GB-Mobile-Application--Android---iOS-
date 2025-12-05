import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { AlertsScreen } from '../screens/Alerts/AlertsScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SiteOverviewScreen } from '../screens/Site/SiteOverviewScreen';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import { AlertDetailScreen } from '../screens/Alerts/AlertDetailScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { surfaceStyles } from '../components';

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  SiteOverview: { siteId: string };
  DeviceDetail: { deviceId: string };
  AlertDetail: { alertId: string };
};

export type AppTabParamList = {
  Dashboard: undefined;
  Alerts: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const tabButton = (testID: string) => (props: BottomTabBarButtonProps) => (
  <TouchableOpacity {...props} testID={testID} accessibilityLabel={testID} />
);

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppTabs() {
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
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
              backgroundColor: colors.surface,
              ...surfaceStyles.shadow,
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
                  backgroundColor: focused ? colors.primarySoft : colors.surfaceMuted,
                  borderWidth: focused ? 0 : 1,
                  borderColor: colors.borderSoft,
                }}
              >
                <Ionicons name={iconName} size={22} color={focused ? colors.primary : color} />
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
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <AppStack.Screen name="Tabs" component={AppTabs} />
      <AppStack.Screen name="SiteOverview" component={SiteOverviewScreen} />
      <AppStack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
      <AppStack.Screen name="AlertDetail" component={AlertDetailScreen} />
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

  return (
    <NavigationContainer>
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
                      backgroundColor: colors.surfaceMuted,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.textPrimary }]}> 
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
