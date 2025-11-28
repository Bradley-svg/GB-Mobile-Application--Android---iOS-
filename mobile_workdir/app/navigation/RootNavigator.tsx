import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { AlertsScreen } from '../screens/Alerts/AlertsScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SiteOverviewScreen } from '../screens/Site/SiteOverviewScreen';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import { AlertDetailScreen } from '../screens/Alerts/AlertDetailScreen';

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

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="SiteOverview" component={SiteOverviewScreen} options={{ title: 'Site' }} />
      <AppStack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: 'Device' }} />
      <AppStack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: 'Alert' }} />
    </AppStack.Navigator>
  );
}

interface RootNavigatorProps {
  isAuthenticated: boolean;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({ isAuthenticated }) => (
  <NavigationContainer>
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="App" component={AppNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  </NavigationContainer>
);
