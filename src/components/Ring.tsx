/**
 * 실행 화면의 원형 링 (핸드오프 5.6) — 306×306, r=137, stroke 14, dasharray 861
 *
 * 진행은 250ms 스냅샷을 그대로 그리지 않는다. 구간이 바뀌거나 시간축이 끊긴
 * 순간(syncKey)에만 기준을 다시 잡고, 그 사이는 남은 시간만큼의 선형
 * 애니메이션으로 흐른다 — 값이 시간 기반이라 프레임이 밀려도 어긋나지 않는다.
 *
 * 링을 잡고 돌리면 현재 구간 안에서 남은 시간을 직접 조정한다.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { selectionTick } from '../feedback';
import { ABS, TABULAR } from '../theme';

export const RING_SIZE = 306;
const R = 137;
const CIRC = 861;
const CENTER = RING_SIZE / 2;
/** 링을 잡을 수 있는 반지름 범위 — 가운데 숫자 영역은 제외한다 */
const GRAB_MIN = 86;
const GRAB_MAX = 168;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 남은 비율 0~1 */
  ratio: number;
  remainSec: number;
  durSec: number;
  title: string;
  clock: string;
  sub: string;
  /** 마지막 3초 — 숫자가 맥동한다. 일시정지 중에는 맥동하지 않는다 */
  warn: boolean;
  paused: boolean;
  /** 바뀌면 애니메이션이 기준을 다시 잡는다 (구간 전환·일시정지·점프) */
  syncKey: string;
  /** 드래그로 남은 시간을 조정 */
  onScrubStart?: () => void;
  onScrub?: (remainSec: number) => void;
  onScrubEnd?: () => void;
};

export function Ring({
  ratio,
  remainSec,
  durSec,
  title,
  clock,
  sub,
  warn,
  paused,
  syncKey,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const prog = useRef(new Animated.Value(ratio)).current;
  const [scrubbing, setScrubbing] = useState(false);

  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;
  const remainRef = useRef(remainSec);
  remainRef.current = remainSec;
  const durRef = useRef(durSec);
  durRef.current = durSec;

  /** 마지막 3초 맥동 */
  useEffect(() => {
    if (!warn) {
      pulse.stopAnimation(() => pulse.setValue(1));
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.42, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [warn, pulse]);

  /** 기준 재설정 + 남은 시간만큼 0을 향해 선형으로 흐르기 */
  useEffect(() => {
    if (scrubbing) return; // 드래그 중에는 손가락이 값을 쥐고 있다
    prog.setValue(Math.max(0, Math.min(1, ratioRef.current)));
    if (paused) return;
    const ms = remainRef.current * 1000;
    if (ms <= 0) return;
    const anim = Animated.timing(prog, {
      toValue: 0,
      duration: ms,
      easing: Easing.linear,
      useNativeDriver: false, // strokeDashoffset은 네이티브 드라이버 대상이 아니다
    });
    anim.start();
    return () => anim.stop();
  }, [syncKey, paused, scrubbing, prog]);

  const dashoffset = useMemo(
    () => prog.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0], extrapolate: 'clamp' }),
    [prog]
  );

  // ---- 드래그로 남은 시간 조정 -------------------------------------------

  const boxRef = useRef<View>(null);
  const center = useRef({ x: 0, y: 0 });
  const lastAngle = useRef(0);
  const accum = useRef(0);
  const startRemain = useRef(0);
  const lastSecond = useRef(0);

  const measure = useCallback(() => {
    boxRef.current?.measureInWindow((x, y, w, h) => {
      center.current = { x: x + w / 2, y: y + h / 2 };
    });
  }, []);

  /** 12시가 0, 시계방향으로 증가 */
  const angleOf = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - center.current.x;
    const dy = e.nativeEvent.pageY - center.current.y;
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += Math.PI * 2;
    return a;
  };

  const onBand = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - center.current.x;
    const dy = e.nativeEvent.pageY - center.current.y;
    const r = Math.hypot(dx, dy);
    return r >= GRAB_MIN && r <= GRAB_MAX;
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => !!onScrub && onBand(e),
        onMoveShouldSetPanResponder: (e) => !!onScrub && onBand(e),
        onPanResponderGrant: (e) => {
          lastAngle.current = angleOf(e);
          accum.current = 0;
          startRemain.current = remainRef.current;
          lastSecond.current = Math.ceil(remainRef.current);
          setScrubbing(true);
          onScrubStart?.();
        },
        onPanResponderMove: (e) => {
          const a = angleOf(e);
          let d = a - lastAngle.current;
          if (d > Math.PI) d -= Math.PI * 2;
          else if (d < -Math.PI) d += Math.PI * 2;
          lastAngle.current = a;
          accum.current += d;

          const dur = durRef.current || 1;
          const next = Math.max(
            0,
            Math.min(dur, startRemain.current + (accum.current / (Math.PI * 2)) * dur)
          );
          prog.setValue(next / dur);

          const sec = Math.ceil(next);
          if (sec !== lastSecond.current) {
            lastSecond.current = sec;
            selectionTick();
          }
          onScrub?.(next);
        },
        onPanResponderRelease: () => {
          setScrubbing(false);
          onScrubEnd?.();
        },
        onPanResponderTerminate: () => {
          setScrubbing(false);
          onScrubEnd?.();
        },
      }),
    [onScrubStart, onScrub, onScrubEnd, prog]
  );

  return (
    <View
      ref={boxRef}
      onLayout={measure}
      style={{ width: RING_SIZE, height: RING_SIZE }}
      {...pan.panHandlers}
    >
      {/* 내부 유리 원판 */}
      <View style={styles.disc}>
        <BlurView intensity={16} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}
      >
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="rgba(0,0,0,0.20)"
          strokeWidth={14}
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={scrubbing ? 17 : 14}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
        />
      </Svg>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={styles.clockWrap} pointerEvents="none">
        <Animated.Text style={[styles.clock, TABULAR, { opacity: pulse }]}>{clock}</Animated.Text>
      </View>

      <Text numberOfLines={1} style={[styles.sub, TABULAR]}>
        {sub}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
    borderRadius: (RING_SIZE - 44) / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  title: {
    position: 'absolute',
    top: 74,
    left: 34,
    right: 34,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.22,
    color: '#FFFFFF',
  },
  clockWrap: {
    ...ABS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    fontSize: 88,
    // lineHeight를 주지 않는다. 88px 글리프의 상하 여백보다 작은 값을 주면
    // 숫자의 위아래가 상자에 잘린다. 폰트 기본 행높이에 맡긴다.
    fontWeight: '800',
    letterSpacing: -4.4,
    // 음수 letterSpacing은 마지막 글자 뒤에도 적용돼 상자가 잉크보다 좁아진다.
    // 좌우 여유를 주어 잘리지 않게 하고, 오른쪽 마진으로 광학 중심을 되돌린다.
    paddingHorizontal: 8,
    marginRight: 4.4,
    color: '#FFFFFF',
    // RN의 textShadow는 글자 상자 안에서 잘려 사각형 자국을 남긴다 — 쓰지 않는다.
  },
  sub: {
    position: 'absolute',
    bottom: 76,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.82,
    color: '#FFFFFF',
  },
});
