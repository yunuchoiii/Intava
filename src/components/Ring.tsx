/**
 * 실행 화면의 원형 링 (실행 화면 v2) — 330×330, r=148, stroke 15, dasharray 930
 *
 * 진행은 250ms 스냅샷을 그대로 그리지 않는다. 구간이 바뀌거나 시간축이 끊긴
 * 순간(syncKey)에만 기준을 다시 잡고, 그 사이는 남은 시간만큼의 선형
 * 애니메이션으로 흐른다 — 값이 시간 기반이라 프레임이 밀려도 어긋나지 않는다.
 *
 * 링은 남은 시간을 그린다. 줄어드는 머리는 12시에서 출발해 **시계방향으로**
 * 전진한다. 링을 잡고 돌리면 그 머리를 미는 것이라, 시계방향은 앞으로 감기다.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { RingTitle } from '../engine/labels';
import { ABS, TABULAR } from '../theme';

export const RING_SIZE = 330;
const R = 148;
const CIRC = 930;
const CENTER = RING_SIZE / 2;
/** 링을 잡을 수 있는 반지름 범위 — 가운데 숫자 영역은 제외한다 */
const GRAB_MIN = 93;
const GRAB_MAX = 181;
/** 이만큼은 움직여야 손짓의 방향을 판단한다 */
const DECIDE_PX = 6;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 남은 비율 0~1 */
  ratio: number;
  remainSec: number;
  durSec: number;
  title: RingTitle;
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


  /**
   * 멈춤의 정도 — 0이면 돌고 있고 1이면 멈춰 있다. 톡 꺼지지 않고 건너간다.
   *
   * **눌리는 것은 링 안쪽 글자뿐이다.** 링 자체(흰 테)는 그대로 둔다 — 그것은
   * 얼마나 남았는지를 그리는 계기판이라, 멈췄다고 흐려지면 읽을 것이 사라진다.
   */
  const dim = useRef(new Animated.Value(paused ? 1 : 0)).current;
  /*
    링을 잡고 있는 동안은 누르지 않는다. 잡으면 세션이 스스로 멈추는데(값을 맞추는
    사이에 시간이 흐르면 손가락과 숫자가 서로 밀린다), 그 멈춤까지 눌림으로 그리면
    지금 맞추고 있는 바로 그 숫자가 흐려진다. 손이 올라가 있는 것은 멈춤이 아니다.
  */
  const held = paused && !scrubbing;
  useEffect(() => {
    Animated.timing(dim, {
      toValue: held ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [held, dim]);

  /** 멈추면 글자는 0.5까지 눌린다 — 색조는 건드리지 않는다 */
  const textDim = useMemo(
    () => dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
    [dim]
  );
  const subDim = useMemo(
    () => dim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 0.5] }),
    [dim]
  );

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

  /**
   * 남은 만큼을 흰 호로 그리되, **줄어드는 머리가 시계방향으로 전진**하게 한다.
   *
   * 오프셋을 양수로 키우면 호가 12시에서 시작해 끝점이 반시계로 물러난다 —
   * 눈에는 링이 거꾸로 도는 것으로 읽힌다. 음수로 주면 dash 패턴이 반대로
   * 밀려서 경과한 만큼이 12시부터 시계방향으로 벗겨지고, 남은 호는 그 뒤를
   * 잇는다. 시계도 스톱워치도 그렇게 돌고, 하단 막대가 왼쪽에서 오른쪽으로
   * 차오르는 것과도 같은 방향이다.
   */
  const dashoffset = useMemo(
    () => prog.interpolate({ inputRange: [0, 1], outputRange: [-CIRC, 0], extrapolate: 'clamp' }),
    [prog]
  );

  // ---- 드래그로 남은 시간 조정 -------------------------------------------

  const lastAngle = useRef(0);
  const accum = useRef(0);
  const startRemain = useRef(0);
  const lastSecond = useRef(0);

  /**
   * 손가락 자리는 링 안쪽 좌표(locationX/Y)로 읽는다. 화면 전체 좌표(pageX/Y)를 쓰면
   * 링의 중심이 화면 어디에 있는지 재야 하는데, 그 값이 어긋나기 쉽다 — 실행 화면은
   * 접힌 자리(축소·화면 밖)에서 펼쳐지고, 변형은 배치를 바꾸지 않아 다시 재지지 않는다.
   * 일시정지 중에는 다시 그려지지도 않아 잘못 잰 값이 그대로 남는다.
   * 안쪽 좌표는 조상이 어떻게 움직이든 늘 이 상자 기준이라 잴 것이 없다.
   */
  const at = (e: GestureResponderEvent) => ({
    dx: e.nativeEvent.locationX - CENTER,
    dy: e.nativeEvent.locationY - CENTER,
  });

  /** 12시가 0, 시계방향으로 증가 */
  const angleOf = (e: GestureResponderEvent) => {
    const { dx, dy } = at(e);
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += Math.PI * 2;
    return a;
  };

  const onBand = (e: GestureResponderEvent) => {
    const { dx, dy } = at(e);
    const r = Math.hypot(dx, dy);
    return r >= GRAB_MIN && r <= GRAB_MAX;
  };

  /**
   * 링을 **도는** 손짓인지, 링을 **가로지르는** 손짓인지.
   *
   * 밴드 위에서 시작했다고 다 시간 조정은 아니다. 화면을 내리려고 링 위쪽을 스치며
   * 곧게 내리긋는 손도 있는데, 그것까지 붙잡으면 내리려다 운동 시간이 거꾸로 간다.
   *
   * 닿은 지점에서 중심을 향하는 방향과 원을 따라 도는 방향으로 움직임을 나눠,
   * 도는 쪽이 크면 시간 조정이다. 3시에서 아래로 긋는 것은 그 자체로 회전이라
   * 지켜지고, 12시에서 아래로 긋는 것은 중심을 가로지르는 것이라 양보한다.
   *
   * 이 판단은 **첫 움직임에서 한 번** 한다. 붙잡고 나면 끝까지 놓지 않는다 —
   * 문지르는 도중에 손가락을 빼앗기면 그것대로 못 쓴다.
   */
  const isTurning = (e: GestureResponderEvent, mx: number, my: number) => {
    const { dx, dy } = at(e);
    const r = Math.hypot(dx, dy) || 1;
    // 중심 방향 성분과 원을 따라 도는 성분
    const radial = Math.abs((mx * dx + my * dy) / r);
    const tangential = Math.abs((mx * -dy + my * dx) / r);
    return tangential >= radial;
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        /**
         * 닿는 순간에는 잡지 않는다. 어느 쪽 손짓인지 아직 모르기 때문이다 —
         * 여기서 잡아 버리면 화면을 내리려는 손까지 시간 조정으로 삼킨다.
         */
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (e, g) =>
          !!onScrub &&
          onBand(e) &&
          Math.hypot(g.dx, g.dy) > DECIDE_PX &&
          isTurning(e, g.dx, g.dy),
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

          /*
            시계방향으로 밀면 **앞으로 감긴다**(남은 시간이 준다). 손가락이 미는
            것은 지금 지나는 머리이고, 그 머리는 시계방향으로 전진하기 때문이다 —
            부호가 반대면 잡은 자리가 손가락과 어긋나게 움직인다.
          */
          const dur = durRef.current || 1;
          const next = Math.max(
            0,
            Math.min(dur, startRemain.current - (accum.current / (Math.PI * 2)) * dur)
          );
          prog.setValue(next / dur);

          const sec = Math.ceil(next);
          if (sec !== lastSecond.current) {
            lastSecond.current = sec;
            selectionTick();
          }
          onScrub?.(next);
        },
        // 한 번 잡았으면 끝까지 쥔다. 무엇을 하려는 손짓인지는 잡기 전에 이미 가렸다.
        onPanResponderTerminationRequest: () => false,
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
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
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
          strokeWidth={scrubbing ? 18 : 15}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
        />
      </Svg>

      {/*
        링 안쪽 위 — 시안 「링 라벨 1a 칩 분리」.

        종목이 있는 자리(운동·세트 휴식)는 두 줄이다: 위에 반투명 단계 칩, 아래에
        종목 이름. 한 줄에 "이름 · 운동"으로 붙이면 이름이 길 때 단계까지 같이
        밀려서 줄을 갈랐다. 긴 이름은 **두 줄까지 접히고 그다음 말줄임**이다 —
        시안(-webkit-line-clamp:2)과 같다. adjustsFontSizeToFit는 못 쓴다: 이
        RN(0.86, 새 아키텍처)에서는 그 속성이 붙는 순간 축소는커녕 말줄임까지
        통째로 죽어 이름이 원 크기 그대로 링 밖까지 뻗는다.

        종목이 없는 자리(웜업·준비·쿨다운·전환·완료)는 칩 없이 단계말 한 줄,
        이전과 같은 자리다.
      */}
      {title.name == null ? (
        <Animated.View style={[styles.titleWrap, { opacity: textDim }]} pointerEvents="none">
          <Text numberOfLines={1} style={styles.title}>
            {title.rest}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.nameWrap, { opacity: textDim }]} pointerEvents="none">
          <View style={styles.chip}>
            <Text style={styles.chipText}>{title.rest}</Text>
          </View>
          <Text numberOfLines={2} style={styles.name}>
            {title.name}
          </Text>
        </Animated.View>
      )}

      {/* 맥동과 멈춤을 겹쳐 곱한다 — 둘을 한 값에 섞으면 드라이버가 엉킨다 */}
      {/* 칩+이름 두 줄이 서는 동안은 시계를 살짝 내린다 — 두 줄 이름과 겹치지 않게(시안의 clockShift) */}
      <Animated.View
        style={[
          styles.clockWrap,
          { opacity: textDim },
          title.name != null && { transform: [{ translateY: 7 }] },
        ]}
        pointerEvents="none"
      >
        <Animated.Text style={[styles.clock, TABULAR, { opacity: pulse }]}>{clock}</Animated.Text>
      </Animated.View>

      <Animated.Text numberOfLines={1} style={[styles.sub, TABULAR, { opacity: subDim }]}>
        {sub}
      </Animated.Text>

      {/*
        손가락을 받는 겹. 링 상자와 정확히 같은 크기여야 안쪽 좌표(locationX/Y)가
        링 기준이 된다 — 회전한 Svg나 글자가 손가락을 받으면 그 조각 기준이 되어
        각도 계산이 어긋난다. 맨 위에 두되 그리는 것은 없다.
      */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: (RING_SIZE - 48) / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  /**
   * 단계말 한 줄(종목 없는 자리)의 자리 — 예전 제목 자리 그대로.
   *
   * 좌우 56은 링과의 숨 자리다. 제목 높이(top 80)에서 흰 테 안쪽까지의 현의
   * 반폭이 약 122라 좌우 36(폭 258)이면 글자가 테에 닿았다. 폭 218이면 양쪽에
   * 12쯤 남는다.
   */
  titleWrap: {
    position: 'absolute',
    top: 80,
    left: 56,
    right: 56,
  },
  title: {
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: '#FFFFFF',
  },
  /** 칩+이름 두 줄(종목 있는 자리)의 자리 — 시안: top 48 · 좌우 52 · 사이 8 */
  nameWrap: {
    position: 'absolute',
    top: 48,
    left: 52,
    right: 52,
    alignItems: 'center',
    gap: 8,
  },
  /** 단계 칩 — 반투명 흰 알약에 흰 글자. 시안의 rgba(255,255,255,.22)+테두리 그대로 */
  chip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4, // 시안의 .03em
    color: '#FFFFFF',
  },
  /** 칩 아래 종목 이름 — 19.5pt, 두 줄까지 */
  name: {
    textAlign: 'center',
    fontSize: 19.5,
    fontWeight: '700',
    letterSpacing: -0.29, // 시안의 -.015em
    lineHeight: 24, // 시안의 1.24
    color: '#FFFFFF',
  },
  clockWrap: {
    ...ABS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    fontSize: 92,
    // lineHeight를 주지 않는다. 92px 글리프의 상하 여백보다 작은 값을 주면
    // 숫자의 위아래가 상자에 잘린다. 폰트 기본 행높이에 맡긴다.
    fontWeight: '800',
    letterSpacing: -4.6,
    // 음수 letterSpacing은 마지막 글자 뒤에도 적용돼 상자가 잉크보다 좁아진다.
    // 좌우 여유를 주어 잘리지 않게 하고, 오른쪽 마진으로 광학 중심을 되돌린다.
    paddingHorizontal: 8,
    marginRight: 4.6,
    color: '#FFFFFF',
    // RN의 textShadow는 글자 상자 안에서 잘려 사각형 자국을 남긴다 — 쓰지 않는다.
  },
  sub: {
    position: 'absolute',
    bottom: 82,
    left: 28,
    right: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
