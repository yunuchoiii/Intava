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
  /**
   * 글자색. 흰 버튼에서는 실행 화면의 페이즈 색을 얹을 때 쓰고,
   * 표면 버튼에서는 「지금은 저장할 것이 없다」를 흐린 회색으로 말할 때 쓴다.
   */
  color?: string;
  /**
   * 이 두 버튼은 늘 확정 동작이다 — 저장하기 · 다시 하기 · 시트의 저장.
   * 그래서 손끝의 대답도 기본이 한 단계 무겁다.
   */
  haptic?: 'tap' | 'commit' | 'none';
};

/** 표면 톤 버튼 — 흰 버튼(주요 실행)보다 한 단계 조용한 확정 동작에 쓴다 */
export function SurfaceButton({
  label,
  onPress,
  disabled,
  height = 68,
  radius = RADIUS.button,
  style,
  /** 글자색 — 기본은 또렷한 흰색. 「저장할 것이 없다」를 말할 때는 한 단계 흐리게 준다 */
  color = C.textPrimary,
  haptic = 'commit',
}: Props) {
  return (
    <PressBox
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      radius={radius}
      scaleTo={0.975}
      dim={0.22}
      accessibilityLabel={label}
      outerStyle={style}
      style={[{ height, borderRadius: radius, backgroundColor: C.surface }, E2]}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color, letterSpacing: -0.2 }}>{label}</Text>
      </View>
    </PressBox>
  );
}

export function WhiteButton({
  label,
  onPress,
  disabled,
  height = 68,
  radius = RADIUS.button,
  style,
  color = C.onWhite,
  haptic = 'commit',
}: Props) {
  return (
    <PressBox
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
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
