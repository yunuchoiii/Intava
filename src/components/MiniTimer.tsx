/**
 * 실행 중 미니 바 — 화면 하단에 붙어 타이머가 돌고 있음을 보여준다.
 *
 * 타이머는 이제 화면이 아니라 세션에 산다. 그래서 목록이나 편집 화면에 있어도
 * 계속 돌고, 이 바가 그 사실을 보여주고 되돌아갈 길을 준다.
 *
 * 실행 화면 위에서도 계속 그려진다 — 투명한 채로 기다리다가, 실행 화면이 접히는
 * 만큼 드러난다. 둘이 같은 값(morph)을 본다.
 */
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock, phaseLabel, titleLabel } from '../engine/labels';
import { useMorph } from '../morph';
import { useSession } from '../session';
import { E3, GUTTER, PHASE_COLOR, RADIUS, TABULAR } from '../theme';
import { PauseIcon, PlayIcon } from './Icons';
import { PressBox } from './PressBox';

const BAR_H = 60;
/** 바와 그 위에 놓인 것(저장 버튼 등) 사이의 숨통 */
const BAR_GAP = 14;

/**
 * 타이머가 돌고 있는지 — 화면마다 조건을 따로 쓰면 어긋난다.
 * 미니 바가 뜨는 조건이자, 그 자리를 내주는 쪽(편집의 시작 버튼)이 물러나는 조건이다.
 */
export function useTimerRunning(): boolean {
  const run = useSession();
  return !!run.preset && !run.done;
}

/**
 * 미니 바가 가리는 만큼의 하단 여백.
 * 하단에 고정된 것이 있는 화면(편집의 저장 버튼, 홈의 추가 버튼 등)은
 * 이만큼 자리를 비워야 바에 덮이지 않는다.
 */
export function useMiniTimerSpace(): number {
  const running = useTimerRunning();
  const pathname = usePathname();
  return running && pathname !== '/run' ? BAR_H + BAR_GAP : 0;
}

/**
 * 접어 내린 직후 이만큼은 열지 않는다.
 *
 * 손을 뗀 뒤 화면이 사라지기까지 260ms가 걸린다. 그 사이에 늦게 도착한 손짓이
 * 이제 막 드러난 미니 바에 닿으면 방금 닫은 것을 도로 여는 셈이 된다 —
 * 끌어내렸는데 타이머가 다시 켜지던 증상이 그것이다.
 */
const REOPEN_GUARD_MS = 450;

export function MiniTimer() {
  const run = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const morph = useMorph();
  const pathname = usePathname();
  const running = useTimerRunning();
  const onRun = pathname === '/run';

  /**
   * 바가 실제로 드러나 있는지 — 경로가 아니라 값을 보고 판단한다.
   *
   * 실행 화면 위에서는 바가 투명하게 깔려만 있어야 한다(그 아래 진행 바를 가로채지
   * 않게). 그런데 접히다 만 상태로 굳으면 실행 화면은 화면 밖인데 바는 눌리지 않아
   * 아무것도 손에 잡히지 않는다. 바가 보이면 누를 수 있어야 빠져나올 길이 남는다.
   */
  const [bared, setBared] = useState(!onRun);
  const baredRef = useRef(bared);
  useEffect(() => {
    const id = morph.p.addListener(({ value }) => {
      const next = value > 0.6;
      if (next === baredRef.current) return;
      baredRef.current = next;
      setBared(next);
    });
    return () => morph.p.removeListener(id);
  }, [morph.p]);

  /** 지금 여는 것이 사용자의 뜻인지 — 이미 열려 있거나 방금 닫았으면 아니다 */
  const mayOpen = useCallback(
    () => !onRun && Date.now() - morph.collapsedAt.current > REOPEN_GUARD_MS,
    [onRun, morph]
  );

  /**
   * 바를 위로 끌어올리면 실행 화면이 자라 오른다. 손가락이 잡는 순간 화면을 띄우고,
   * 끝까지 올리지 않고 놓으면 다시 접으면서 방금 띄운 화면을 물린다.
   */
  const openPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          mayOpen() && g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderGrant: () => {
          morph.stop();
          morph.dragging.current = true;
          router.push('/run');
        },
        onPanResponderMove: (_e, g) => morph.set(Math.max(0, Math.min(1, 1 + g.dy / screenH))),
        onPanResponderRelease: (_e, g) => {
          morph.dragging.current = false;
          if (-g.dy > 110 || -g.vy > 0.7) {
            morph.animate(0, { velocity: (g.vy * 1000) / screenH });
          } else {
            morph.animate(1, { duration: 220, onDone: () => router.back() });
          }
        },
        onPanResponderTerminate: () => {
          morph.dragging.current = false;
          morph.animate(1, { duration: 220, onDone: () => router.back() });
        },
      }),
    [morph, router, screenH, mayOpen]
  );

  /** 실행 화면이 접히는 만큼 아래에서 올라오며 드러난다 */
  const barH = BAR_H + insets.bottom;
  const appear = morph.p.interpolate({
    inputRange: [0.12, 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rise = morph.p.interpolate({
    inputRange: [0, 0.5],
    outputRange: [barH, 0],
    extrapolate: 'clamp',
  });

  if (!running || !run.preset) return null;

  const color = PHASE_COLOR[run.seg?.phase ?? 'DONE'];
  const title = run.seg
    ? titleLabel(run.seg, run.paused)
    : phaseLabel('DONE');

  return (
    <Animated.View
      style={[styles.wrap, { opacity: appear, transform: [{ translateY: rise }] }]}
      // 실행 화면이 펼쳐져 있을 때는 투명하게 깔려만 있다 — 그 아래 진행 바를 가로채지 않는다
      pointerEvents={!onRun || bared ? 'box-none' : 'none'}
      {...openPan.panHandlers}
    >
      <PressBox
        onPress={() => mayOpen() && router.push('/run')}
        radius={0}
        scaleTo={0.99}
        dim={0.16}
        style={[
          styles.bar,
          // 홈 인디케이터 자리만큼 아래로 더 자라고, 글은 그 위에 머문다
          { backgroundColor: color, height: barH, paddingBottom: insets.bottom },
          E3,
        ]}
        accessibilityLabel={title}
      >
        <View style={styles.inner}>
          <Text style={[styles.clock, TABULAR]}>{clock(run.remain)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <PressBox
            onPress={run.toggle}
            haptic="commit"
            radius={18}
            scaleTo={0.9}
            dim={0.18}
            style={styles.toggle}
            accessibilityLabel={title}
          >
            <View style={styles.center}>
              {run.paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
            </View>
          </PressBox>
        </View>
      </PressBox>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** 화면 바닥에 딱 붙는다 — 좌우로도 끝까지 간다 */
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /** 위쪽 모서리만 둥글다. 아래는 화면 끝이라 깎을 자리가 없다 */
  bar: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    gap: 12,
  },
  clock: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: '#FFFFFF' },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF', opacity: 0.9 },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
