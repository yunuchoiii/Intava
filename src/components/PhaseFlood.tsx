/**
 * 페이즈 플러드 배경 (핸드오프 2장)
 *
 *   radial-gradient(120% 70% at 18% -8%, rgba(255,255,255,.20), transparent 58%)
 *   linear-gradient(168deg, LIGHT 0%, BASE 52%, DARK 100%)
 *
 * 배경 전환은 .6s — RN에는 background transition이 없으므로 이전 색 레이어를
 * 그대로 두고 새 색 레이어를 0.6s 동안 페이드 인시킨다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, RadialGradient, Rect, Stop } from 'react-native-svg';
import { floodColors } from '../theme';

/** 168deg CSS 그라디언트 축을 objectBoundingBox 좌표로 옮긴 값 */
const AXIS = { x1: '0.396', y1: '0.011', x2: '0.604', y2: '0.989' };

function Layer({ color, id }: { color: string; id: string }) {
  const { light, base, dark } = floodColors(color);
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <SvgLinear id={`f${id}`} x1={AXIS.x1} y1={AXIS.y1} x2={AXIS.x2} y2={AXIS.y2}>
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.52" stopColor={base} />
          <Stop offset="1" stopColor={dark} />
        </SvgLinear>
        <RadialGradient id={`g${id}`} cx="0.18" cy="-0.08" rx="1.2" ry="0.7">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
          <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#f${id})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g${id})`} />
    </Svg>
  );
}

export function PhaseFlood({ color }: { color: string }) {
  const [prev, setPrev] = useState(color);
  const [curr, setCurr] = useState(color);
  const fade = useRef(new Animated.Value(1)).current;
  const gen = useRef(0);

  useEffect(() => {
    if (color === curr) return;
    setPrev(curr);
    setCurr(color);
    gen.current += 1;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [color, curr, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Layer color={prev} id={`p${gen.current}`} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Layer color={curr} id={`c${gen.current}`} />
      </Animated.View>
    </View>
  );
}
