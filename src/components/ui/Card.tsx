import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '../../theme/tokens';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}>;

export function Card({ children, style, padded = true, elevated = true }: Props) {
  return (
    <View
      style={[
        styles.base,
        padded && { padding: spacing.lg },
        elevated && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
});
