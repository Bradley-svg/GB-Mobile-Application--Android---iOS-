import React from 'react';
import { View } from 'react-native';
import { spacing } from '../theme/spacing';
import { PillTab } from './PillTab';

type Option<T extends string | number> = {
  value: T;
  label: string;
};

type PillTabGroupProps<T extends string | number> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function PillTabGroup<T extends string | number>({
  value,
  options,
  onChange,
}: PillTabGroupProps<T>) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {options.map((option) => (
        <View key={option.value} style={{ marginRight: spacing.sm }}>
          <PillTab label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
        </View>
      ))}
    </View>
  );
}
