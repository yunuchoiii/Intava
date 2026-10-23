/**
 * 실행 화면의 원형 링 (실행 화면 v2) — 330×330, r=148, stroke 15
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
  AppState,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { scrubTick } from '../feedback';
import { ABS, TABULAR } from '../theme';

export const RING_SIZE = 330;
const R = 148;
const CENTER = RING_SIZE / 2;
/** 링을 잡을 수 있는 반지름 범위 — 가운데 숫자 영역은 제외한다 */
const GRAB_MIN = 93;
const GRAB_MAX = 181;
/** 이만큼은 움직여야 손짓의 방향을 판단한다 */
const DECIDE_PX = 6;

/**
 * 링의 진행은 **회전(transform)만으로** 그린다 — RN 네이티브 드라이버가 iOS에서
 * 직접 돌리고, JS는 구간이 바뀔 때 한 번 값을 건다.
 *
 * 예전에는 SVG 원의 strokeDashoffset을 reanimated로 흘렸다. 그런데 SVG 속성은
 * reanimated가 네이티브로 바로 꽂지 못하는 「JS 속성」이라, 매 프레임 UI 스레드가
 * 값을 JS로 넘기고 JS가 setNativeProps로 화면 트리 전체를 다시 커밋했다.
 * 실기기(iPhone 18 Pro) 계측: 화면을 잠근 채로도 프로세스 CPU 125%, 한 시간 운동에
 * 배터리 46%와 심한 발열. 회전은 커밋 없이 레이어만 돌린다.
 *
 * 그리는 법: 남은 호는 경과각 θ(12시 기준 시계방향 0~360°)부터 360°까지다.
 * - 오른쪽 반(0~180°): 오른쪽 반원을 θ만큼 돌려 오른쪽 창으로 자른다 → [θ, 180°].
 *   θ가 180°를 넘으면 반원이 왼쪽으로 다 넘어가 창에 남는 것이 없다.
 * - 왼쪽 반(180~360°): θ가 180°가 될 때까지 그대로 있다가, 그 뒤 θ−180°만큼 돈다.
 * - 끝 모양: 12시에 고정 점, 머리(θ)에 도는 팔 끝의 점 — SVG의 둥근 끝과 같다.
 */

type Props = {
  /** 남은 비율 0~1 */
  ratio: number;
  remainSec: number;
  durSec: number;
  /** 링 안 시계 위의 단계말("운동"·"휴식"·"웜업") — 종목 이름은 링 밖(실행 화면 머리 아래)이다 */
  title: string;
  clock: string;
  sub: string;
  /** 마지막 N초(카운트다운 설정과 같은 길이) — 숫자가 맥동한다. 일시정지 중에는 맥동하지 않는다 */
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
  /** 경과각 0~360° — 남은 비율 r이면 (1−r)×360 */
  const theta = useRef(new Animated.Value(angleFor(ratio))).current;
  const [scrubbing, setScrubbing] = useState(false);

  /**
   * 화면이 앞에 있을 때만 흐른다.
   *
   * ⚠️ 링의 진행은 구간 내내 도는 애니메이션이고, 애니메이션은 **매 프레임** 값을
   * 계산해 그린다. 앱이 뒤로 가도 이 루프는 멈추지 않았다 — 스토어 빌드(RN
   * Animated, JS 드라이버)는 JS 스레드에서, reanimated로 옮긴 뒤에는 UI 스레드에서
   * 계속 돌았다. 실기기(iOS 27.2)에서 iOS가 "CPU 80% 초과, 60초"로 앱을 죽인
   * 리포트가 그것이고(cpu_resource_fatal, JS 스레드 스택), 시뮬레이터에서
   * Safari 뒤로 보낸 채 재도 프로세스 CPU가 25%였다. 한 시간 운동에 배터리
   * 15~20%, 발열, 그리고 죽은 뒤 알림음이 안 나던 것이 전부 이 루프였다.
   *
   * 뒤에 있을 때는 그릴 화면이 없다. 애니메이션을 세우고 값만 맞춰 두었다가,
   * 앞으로 오면 세션이 syncId를 올려 주므로(AppState active) 그때 다시 잇는다.
   */
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

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

  /** 마지막 N초 맥동 — 뒤에 있을 때는 이것도 세운다(같은 이유) */
  useEffect(() => {
    if (!warn || !active) {
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
  }, [warn, active, pulse]);

  /** 기준 재설정 + 남은 시간만큼 360°를 향해 선형으로 흐르기 */
  useEffect(() => {
    if (scrubbing) return; // 드래그 중에는 손가락이 값을 쥐고 있다
    theta.stopAnimation();
    theta.setValue(angleFor(ratioRef.current));
    if (paused || !active) return;
    const ms = remainRef.current * 1000;
    if (ms <= 0) return;
    const run = Animated.timing(theta, {
      toValue: 360,
      duration: ms,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [syncKey, paused, scrubbing, active, theta]);

  /*
    호는 줄어드는 머리가 12시에서 출발해 **시계방향으로** 전진한다. 시계도
    스톱워치도 그렇게 돌고, 하단 막대가 왼쪽에서 오른쪽으로 차오르는 것과도 같다.
  */
  const rightTurn = useMemo(
    () => theta.interpolate({ inputRange: [0, 180, 360], outputRange: ['0deg', '180deg', '180deg'] }),
    [theta]
  );
  const leftTurn = useMemo(
    () => theta.interpolate({ inputRange: [0, 180, 360], outputRange: ['0deg', '0deg', '180deg'] }),
    [theta]
  );
  const headTurn = useMemo(
    () => theta.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }),
    [theta]
  );
  /** 다 흐르면 두 끝 점도 걷는다 — 남은 호가 없는데 12시에 점 하나가 남지 않게 */
  const capShow = useMemo(
    () => theta.interpolate({ inputRange: [0, 359, 360], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
    [theta]
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
          // 흐르던 값을 여기서 세운다 — 손가락이 쥔 값 위로 애니메이션이 계속 밀면 서로 다툰다
          theta.stopAnimation();
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
          theta.setValue(angleFor(next / dur));

          const sec = Math.ceil(next);
          if (sec !== lastSecond.current) {
            lastSecond.current = sec;
            scrubTick();
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
    [onScrubStart, onScrub, onScrubEnd, theta]
  );

  const stroke = scrubbing ? 18 : 15;

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

      {/* 바탕 트랙 */}
      <View style={[styles.band, bandBox(TRACK_W), { borderColor: 'rgba(0,0,0,0.20)' }]} pointerEvents="none" />

      {/* 남은 호 — 오른쪽 반과 왼쪽 반을 따로 돌려 자른다(위 설명) */}
      <View style={[styles.half, { left: CENTER }]} pointerEvents="none">
        <Animated.View style={[styles.turner, { left: -CENTER, transform: [{ rotate: rightTurn }] }]}>
          <View style={[styles.half, { left: CENTER }]}>
            <View style={[styles.band, bandBox(stroke), { left: bandBox(stroke).left - CENTER }]} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.half, { left: 0 }]} pointerEvents="none">
        <Animated.View style={[styles.turner, { transform: [{ rotate: leftTurn }] }]}>
          <View style={[styles.half, { left: 0 }]}>
            <View style={[styles.band, bandBox(stroke)]} />
          </View>
        </Animated.View>
      </View>

      {/* 둥근 끝 — 12시 고정 점과 머리를 따라 도는 점 */}
      <Animated.View style={[styles.turner, { opacity: capShow }]} pointerEvents="none">
        <View style={[styles.cap, capBox(stroke)]} />
      </Animated.View>
      <Animated.View
        style={[styles.turner, { opacity: capShow, transform: [{ rotate: headTurn }] }]}
        pointerEvents="none"
      >
        <View style={[styles.cap, capBox(stroke)]} />
      </Animated.View>

      {/*
        링 안쪽 위 — 시안 「링 위 5a: 이름이 주인공」.

        링 안에는 **어느 단계든 단계말 하나만** 선다("운동"·"휴식"·"웜업"…).
        종목 이름과 메모는 링 밖, 실행 화면 머리줄 바로 아래로 나갔다 — "뭘
        하는지"를 먼저 읽고 시선이 타이머로 내려가는 순서다. 덕분에 링 안 글자는
        길이가 뻔해 축소·말줄임 장치가 통째로 필요 없어졌다.
      */}
      <Animated.View style={[styles.titleWrap, { opacity: textDim }]} pointerEvents="none">
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </Animated.View>

      {/* 맥동과 멈춤을 겹쳐 곱한다 — 둘을 한 값에 섞으면 드라이버가 엉킨다 */}
      <Animated.View style={[styles.clockWrap, { opacity: textDim }]} pointerEvents="none">
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

/** 남은 비율(1이면 가득) → 경과각 */
function angleFor(ratio: number): number {
  return (1 - Math.max(0, Math.min(1, ratio))) * 360;
}

const TRACK_W = 14;

/** 반지름 R의 중심선에 굵기 w로 그린 고리의 상자 */
function bandBox(w: number) {
  const d = R * 2 + w;
  const o = CENTER - d / 2;
  return { left: o, top: o, width: d, height: d, borderRadius: d / 2, borderWidth: w };
}

/** 12시 자리의 끝 점 — 굵기와 같은 지름 */
function capBox(w: number) {
  return { left: CENTER - w / 2, top: CENTER - R - w / 2, width: w, height: w, borderRadius: w / 2 };
}

const styles = StyleSheet.create({
  band: { position: 'absolute', borderColor: '#FFFFFF' },
  /** 반쪽 창 — 링 상자의 왼쪽 또는 오른쪽 절반만 보인다 */
  half: { position: 'absolute', top: 0, width: CENTER, height: RING_SIZE, overflow: 'hidden' },
  /** 링 상자와 같은 크기의 회전판 — 가운데를 축으로 돈다 */
  turner: { position: 'absolute', top: 0, left: 0, width: RING_SIZE, height: RING_SIZE },
  cap: { position: 'absolute', backgroundColor: '#FFFFFF' },
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
   * 단계말의 자리 — 어느 단계든 이 하나다. 시안 5a의 16pt는 실기기에서 너무
   * 작다는 피드백이라, 예전 제목과 같은 23pt로 되돌렸다(자리도 그때의 top 80).
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
