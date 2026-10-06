import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '../../theme/tokens';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

type Props = {
  name: FeatherIconName;
  size?: number;
  color?: ColorValue;
};

export function Icon({ name, size = 20, color = colors.text }: Props) {
  return <Feather name={name} size={size} color={color} />;
}
