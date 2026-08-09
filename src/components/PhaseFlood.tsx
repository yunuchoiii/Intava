/**
 * 페이즈 플러드 배경 (핸드오프 2장)
 *
 *   radial-gradient(120% 70% at 18% -8%, rgba(255,255,255,.20), transparent 58%)
 *   linear-gradient(168deg, LIGHT 0%, BASE 52%, DARK 100%)
 *
 * 배경 전환은 .6s — RN에는 background transition이 없으므로 겹을 둘 두고 하나를
 * 벗긴다.
 *
 * **새 색은 반드시 보이지 않는 겹에 먼저 칠한다.** 위 겹이 늘 아래를 완전히 덮고
 * 있어서, 아래에 새 색을 칠하는 것은 화면에 아무 일도 일으키지 않는다. 그런 뒤
 * 위 겹을 서서히 벗기면 새 색이 드러난다.
 *
 * 거꾸로 하면(보이는 겹에 새 색을 칠하고 투명도를 0으로 되돌리면) 그 되돌림은
 * 네이티브 쪽으로 따로 건너가서 React의 커밋보다 한 프레임 늦게 닿을 수 있다.
 * 그 한 프레임에 새 색이 통째로 그려진다 — ⏭를 눌렀을 때 초록 화면에 빨강이
 * 번쩍 나타났다 사라지던 것이 그것이다. 화면 전체라 유난히 크게 보였다.
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
  /** 아래 겹 — 새 색이 들어오는 자리. 위 겹이 덮고 있어 칠해도 보이지 않는다 */
  const [under, setUnder] = useState(color);
  /** 위 겹 — 옛 색. 이것이 벗겨지면서 아래가 드러난다 */
  const [over, setOver] = useState(color);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (color === under) return;
    setUnder(color);
    Animated.timing(fade, { toValue: 0, duration: 600, useNativeDriver: true }).start(
      ({ finished }) => finished && setOver(color)
    );
  }, [color, under, fade]);

  /**
   * 다 건너간 뒤 위 겹을 새 색으로 갈고 다시 덮어 둔다 — 다음 전환에서도 아래가
   * 가려져 있어야 한다. 이 시점에는 두 겹이 같은 색이라 어느 쪽이 먼저 닿든
   * 화면에는 아무 변화가 없다.
   */
  useEffect(() => {
    fade.setValue(1);
  }, [over, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Layer color={under} id={`u${under.slice(1)}`} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Layer color={over} id={`o${over.slice(1)}`} />
      </Animated.View>
    </View>
  );
}
