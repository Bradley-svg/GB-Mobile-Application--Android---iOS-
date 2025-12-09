/* eslint react-native/no-unused-styles: "warn" */
import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { ThemedStatusBar } from '../theme/ThemedStatusBar';
import { createThemedStyles } from '../theme/createThemedStyles';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  scrollTestID?: string;
};

export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  testID,
  scrollTestID,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      testID={scrollTestID}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, contentContainerStyle]} testID={scrollTestID}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, style]} testID={testID}>
      <ThemedStatusBar />
      {content}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    screenContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
  });
