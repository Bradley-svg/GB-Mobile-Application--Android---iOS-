import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { softShadow } from './styles';

type IconButtonProps = {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const IconButton: React.FC<IconButtonProps> = ({ icon, onPress, size = 40, style, testID }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.9}
    testID={testID}
    style={[
      styles.iconButton,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      style,
    ]}
  >
    {icon}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  iconButton: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...softShadow,
  },
});
