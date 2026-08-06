/**
 * 누르면 살짝 작아지면서 어두워지고, 떼면 제자리로 돌아오는 버튼 껍데기.
 *
 * 크기와 농도를 하나의 Animated.Value(0=뗀 상태, 1=누른 상태)로 함께 몰아서
 * 두 변화가 어긋나지 않게 한다. 누를 때는 튕김 없이 빠르게, 뗄 때는 살짝
 * 튕기며 돌아온다 — 손가락을 뗀 쪽이 기분 좋게 읽힌다.
 */
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  onPress?: () => void;
  disabled?: boolean;
  /** 버튼의 생김새 — 배경·모서리·그림자. 눌리면 이 겹이 함께 줄어든다 */
  style?: StyleProp<ViewStyle>;
  /** 바깥 껍데기에 거는 배치용 스타일 — flex 같은 것은 여기로 와야 한다 */
  outerStyle?: StyleProp<ViewStyle>;
  /** 눌렸을 때 크기 배율 */
  scaleTo?: number;
  /** 눌렸을 때 덮이는 검정 농도 */
  dim?: number;
  /** 어두워지는 겹이 버튼 모서리를 따라가도록 반경을 알려준다 */
  radius?: number;
  hitSlop?: number;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

export function PressBox({
  onPress,
  disabled,
  style,
  outerStyle,
  scaleTo = 0.96,
  dim = 0.18,
  radius = 0,
  hitSlop,
  accessibilityLabel,
  children,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  const { scale, shade } = useMemo(
    () => ({
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }),
      shade: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dim] }),
    }),
    [anim, scaleTo, dim]
  );

  const to = (v: number) =>
    Animated.spring(anim, {
      toValue: v,
      useNativeDriver: true,
      speed: v === 1 ? 50 : 26,
      bounciness: v === 1 ? 0 : 7,
    }).start();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => !disabled && to(1)}
      onPressOut={() => to(0)}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={outerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.4 }]}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000', borderRadius: radius, opacity: shade },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
