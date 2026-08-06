/** button/white — linear-gradient(180deg,#FFFFFF,#E9EBEF), text #0E0E11 */
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C, E2, RADIUS } from '../theme';
import { PressBox } from './PressBox';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** 흰 버튼 위 글자색 — 실행 화면에서는 페이즈 색을 쓴다 */
  color?: string;
};

export function WhiteButton({
  label,
  onPress,
  disabled,
  height = 68,
  radius = RADIUS.button,
  style,
  color = C.onWhite,
}: Props) {
  return (
    <PressBox
      onPress={onPress}
      disabled={disabled}
      radius={radius}
      scaleTo={0.975}
      dim={0.14}
      accessibilityLabel={label}
      outerStyle={style}
      style={[{ height, borderRadius: radius, backgroundColor: C.white }, E2]}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color, letterSpacing: -0.2 }}>{label}</Text>
      </View>
    </PressBox>
  );
}
