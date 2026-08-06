/**
 * 화면 배경.
 *
 * 그라디언트(bg/screen)는 **홈에서만** 쓴다. 편집·설정처럼 목록과 값이 빽빽한
 * 화면에서는 배경이 위아래로 밝기를 바꾸면 같은 표면이 위치에 따라 달라 보인다.
 * 그런 화면은 단색으로 깔고, 표면과의 대비를 한 값으로 고정한다.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

/** 세로 그라디언트 + 좌상단 푸른 라디얼 (핸드오프 7장) */
export function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[C.bgTop, C.bgBottom, C.bgBottom]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="0.15" cy="-0.06" rx="1.1" ry="0.6">
            <Stop offset="0" stopColor="#788CFF" stopOpacity={0.14} />
            <Stop offset="0.6" stopColor="#788CFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
    </View>
  );
}

export function Screen({
  children,
  style,
  gradient = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 홈 전용 */
  gradient?: boolean;
}) {
  return (
    <View
      style={[{ flex: 1, backgroundColor: gradient ? C.bgBase : C.bgPlain }, style]}
    >
      {gradient && <ScreenBackground />}
      {children}
    </View>
  );
}
