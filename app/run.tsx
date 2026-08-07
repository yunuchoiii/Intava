/** 5.6 실행 화면 — 이 앱의 심장 */
import { useFocusEffect, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FloodTile } from '../src/components/Surface';
import { PressBox } from '../src/components/PressBox';
import { NextIcon, PauseIcon, PencilIcon, PlayIcon, PrevIcon } from '../src/components/Icons';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { Ring } from '../src/components/Ring';
import { clock, isSimple, segLabel, subLabel, titleLabel } from '../src/engine/labels';
import { useMorph } from '../src/morph';
import { ensurePermission } from '../src/notify';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { C, GUTTER, PHASE_COLOR, TABULAR } from '../src/theme';

export default function Run() {
  const router = useRouter();
  /** 미니 바와 공유하는 값 — 0은 가득 찬 상태, 1은 접힌 상태 */
  const morph = useMorph();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  /**
   * 끌어내리기를 받지 않는 아래쪽 경계 — 컨트롤 줄부터 아래는 버튼의 자리다.
   * 링은 자기 PanResponder가 밴드에서 손가락을 붙잡고 놓지 않으므로 따로 뺄 것이 없다.
   */
  const noDragTop = useRef(Number.POSITIVE_INFINITY);
  const measureControls = useCallback((e: LayoutChangeEvent) => {
    // 이 줄이 놓인 곳은 화면 맨 위에서부터 재도 같다 — 감싸는 겹이 원점에서 시작한다
    noDragTop.current = e.nativeEvent.layout.y;
  }, []);
  /** 손가락이 처음 닿은 높이 — gestureState.y0는 붙잡은 뒤에야 채워져서 판단에 쓸 수 없다 */
  const grabY = useRef(0);
  const { settings } = useStore();
  const run = useSession();
  const preset = run.preset;
  useEffect(() => {
    void ensurePermission();
  }, []);

  useEffect(() => {
    if (!settings.keepScreenOn) return;
    void activateKeepAwakeAsync('intava-run');
    return () => {
      void deactivateKeepAwake('intava-run');
    };
  }, [settings.keepScreenOn]);

  // 전체가 끝나면 완료 화면으로 — 세션은 완료 화면에서 정리한다
  useEffect(() => {
    if (!run.done || !preset) return;
    router.replace({ pathname: '/done', params: { id: preset.id } });
  }, [run.done, preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  /**
   * 이 화면이 앞에 설 때마다 펼친다.
   *
   * 처음 뜰 때만 하면 안 된다. 편집이나 설정으로 나가면 이 화면은 덮인 채 남아 있고
   * 그동안 값은 1(접힘)로 돌아가는데, 돌아왔을 때 되돌리지 않으면 화면이 투명한 채로
   * 화면 밖에 머문다 — 아무것도 눌리지 않는 그 상태다.
   *
   * 처음 한 번은 미니 바 자리에서 자라 오르지만, 다녀온 뒤에는 이미 제자리에 있어야
   * 하므로 애니메이션 없이 앉힌다. 손가락이 값을 쥐고 있으면 손에 맡긴다.
   */
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (morph.dragging.current) return;
      if (opened.current) {
        morph.set(0);
        return;
      }
      opened.current = true;
      morph.animate(0, { duration: 340 });
    }, [morph])
  );

  /**
   * 화면 어디를 잡고 끌어내려도 따라 내려가고, 충분히 내려가면 접힌다 —
   * 바텀시트처럼 다룬다. 접히면서 그대로 하단 미니 바가 된다.
   *
   * 두 곳만 비켜 간다. 링의 밴드는 링이 손가락을 붙잡고 놓지 않고(Ring의
   * onPanResponderTerminationRequest), 컨트롤 줄부터 아래는 시작점으로 걸러낸다.
   */
  const dismissPan = useMemo(
    () =>
      PanResponder.create({
        // 붙잡지는 않고 시작점만 적어 둔다 — 캡처 단계라 아래 버튼이 먼저 가져가도 지나간다
        onStartShouldSetPanResponderCapture: (e) => {
          grabY.current = e.nativeEvent.pageY;
          return false;
        },
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy > 8 &&
          // 세로가 확실히 우세할 때만. 링 바깥을 스치듯 가로로 긋다가 닫히지 않게 한다
          Math.abs(g.dy) > Math.abs(g.dx) * 1.5 &&
          grabY.current < noDragTop.current,
        onPanResponderGrant: () => {
          // 아직 펼쳐지는 중일 수 있다 — 손가락이 값을 넘겨받는다
          morph.stop();
          morph.dragging.current = true;
        },
        // 손가락 이동은 화면 높이로 나눠 0~1로 읽는다 — 아래로 끌수록 1에 가까워진다
        onPanResponderMove: (_e, g) => morph.set(Math.max(0, Math.min(1, g.dy / screenH))),
        onPanResponderRelease: (_e, g) => {
          morph.dragging.current = false;
          if (g.dy > 110 || g.vy > 0.7) {
            // 끝까지 접은 뒤에 나간다. 그때 화면은 이미 투명해져 미니 바만 남아 있다
            morph.collapsedAt.current = Date.now();
            morph.animate(1, { duration: 260, onDone: dismiss });
          } else {
            morph.animate(0, { velocity: (g.vy * 1000) / screenH });
          }
        },
        onPanResponderTerminate: () => {
          morph.dragging.current = false;
          morph.animate(0);
        },
      }),
    [morph, screenH, dismiss]
  );

  /**
   * 접히는 몸짓 — 아래로 미끄러지면서 작아지고, 반쯤 가면 사라진다.
   * 크기는 앞쪽에서 빨리 줄어든다. 조금만 끌어도 "작아지는 중"이 손에 읽혀야 한다.
   */
  const translateY = morph.p.interpolate({ inputRange: [0, 1], outputRange: [0, screenH] });
  const scale = morph.p.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 0.9, 0.86],
    extrapolate: 'clamp',
  });
  const fade = morph.p.interpolate({
    inputRange: [0, 0.2, 0.55],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });
  const corner = morph.radius.interpolate({
    inputRange: [0, 0.12],
    outputRange: [0, 28],
    extrapolate: 'clamp',
  });

  if (!preset) {
    // 여기 걸리면 데이터가 어긋난 것이다. 빈 화면에 가두지 않는다.
    return <MissingPreset />;
  }

  const phase = run.seg?.phase ?? 'DONE';
  const color = PHASE_COLOR[phase];
  const simple = isSimple(preset);
  // 웜업·준비·라운드 휴식·쿨다운에서는 종목 이름이 전부 흐리다.
  // 종목 전환 중에는 도착할 종목을 밝힌다 — 아래 줄의 "3번째 종목"과 같은 것을 가리킨다.
  const currentBlk = !run.seg
    ? -1
    : run.seg.phase === 'WORK' || run.seg.phase === 'SET_REST'
      ? (run.seg.blk ?? -1)
      : run.seg.phase === 'BLOCK_REST'
        ? (run.seg.blk ?? -1) + 1
        : -1;

  /**
   * 편집으로 간다 — 실행 화면 **위에** 올리지 않고, 먼저 미니 바로 접은 뒤에 연다.
   *
   * 이 화면은 투명 모달이라 그 위에 무엇을 밀어 넣으면 iOS가 모달로 띄운다. 그러면
   * 편집 화면이 미니 바를 덮어 하단에 바 자리만 빈 채로 남고, 시트로 뜰 때는 아래로
   * 끌어 닫는 제스처까지 붙어 종목을 끄는 손짓과 다툰다.
   * 접고 나서 열면 편집 화면은 홈 위에 평범하게 놓이고, 타이머는 바에서 계속 돈다.
   */
  const goEdit = () => {
    const id = preset.id;
    morph.animate(1, {
      duration: 260,
      onDone: () => {
        router.dismissTo('/');
        router.push({ pathname: '/edit', params: { id } });
      },
    });
  };

  const confirmExit = () => {
    Alert.alert(t('run.exitTitle'), t('run.exitBody'), [
      { text: t('run.exitContinue'), style: 'cancel' },
      {
        text: t('run.exitConfirm'),
        style: 'destructive',
        onPress: () => {
          // 홈까지 물러난다. replace로 갈아끼우면 홈 위에 홈이 한 겹 더 쌓인다.
          // 나가고 나서 세션을 비운다 — 순서가 바뀌면 프리셋 없는 실행 화면이 한 번 그려진다
          router.dismissTo('/');
          run.stop();
        },
      },
    ]);
  };

  /**
   * 왼쪽 버튼 — skipPrev가 실제로 하는 일을 그대로 적는다.
   * 구간에 1.2초 넘게 들어와 있으면 그 구간을 처음으로 되돌리고, 아니면 앞 구간으로 간다.
   * 첫 구간에는 앞이 없으니 늘 "다시 처음"이다.
   */
  const prevSeg = run.seg && run.elapsed - run.seg.start <= 1.2 ? run.prev : undefined;
  const prevLabel = prevSeg ? segLabel(prevSeg) : t('run.prevRestart');
  const barPct = run.total > 0 ? Math.min(100, (run.elapsed / run.total) * 100) : 0;

  return (
    /*
      위에서 아래로 끌어내리면 접혀서 하단 미니 바가 된다 — 타이머는 계속 돈다.

      겹이 둘인 이유: 자리·크기·투명도는 네이티브 드라이버로 돌고, 모서리 반경은
      JS 쪽에서 돌아야 한다. 한 겹에 섞으면 RN이 거부한다.
    */
    <Animated.View
      style={[styles.fill, { opacity: fade, transform: [{ translateY }, { scale }] }]}
      {...dismissPan.panHandlers}
    >
      <Animated.View style={[styles.fill, styles.card, { backgroundColor: color, borderRadius: corner }]}>
      <PhaseFlood color={color} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <PressBox
            onPress={confirmExit}
            radius={16}
            scaleTo={0.9}
            dim={0.2}
            accessibilityLabel={t('run.a11yExit')}
          >
            <FloodTile radius={16} style={styles.tile}>
              <View style={styles.center}>
                <Text style={styles.tileGlyph}>✕</Text>
              </View>
            </FloodTile>
          </PressBox>

          <Text style={styles.routineName} numberOfLines={1}>
            {preset.name}
          </Text>

          <PressBox
            onPress={goEdit}
            radius={16}
            scaleTo={0.9}
            dim={0.2}
            accessibilityLabel={t('run.a11yEdit')}
          >
            <FloodTile radius={16} style={styles.tile}>
              <View style={[styles.center, { opacity: 0.9 }]}>
                <PencilIcon />
              </View>
            </FloodTile>
          </PressBox>
        </View>

        {/* 종목 이름 줄 — 버튼이 아니라 표시. 배경·테두리를 주지 않는다 */}
        {!simple && (
          <View style={styles.blockRow}>
            {preset.blocks.map((b, i) => (
              <Text
                key={b.id}
                style={[styles.blockName, i === currentBlk ? styles.blockNow : styles.blockOther]}
              >
                {b.name}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.ringWrap}>
          <Ring
            ratio={run.ratio}
            remainSec={run.remain}
            durSec={run.seg?.dur ?? 0}
            title={titleLabel(run.seg, run.paused, preset)}
            clock={clock(run.remain)}
            sub={subLabel(run.seg, preset)}
            warn={!run.done && run.remain <= 3 && !run.paused}
            paused={run.paused}
            syncKey={`${run.idx}:${run.syncId}`}
            onScrubStart={run.beginScrub}
            onScrub={run.done ? undefined : run.scrubRemain}
            onScrubEnd={run.commitScrub}
          />
        </View>

        {/* 여기부터 아래는 버튼의 자리 — 끌어내려 닫기를 받지 않는다 */}
        <View onLayout={measureControls} style={{ paddingHorizontal: GUTTER, gap: 20 }}>
          <View style={styles.controls}>
            <ControlButton label={prevLabel} onPress={run.skipPrev}>
              <PrevIcon />
            </ControlButton>

            <PressBox
              onPress={run.toggle}
              radius={48}
              scaleTo={0.93}
              dim={0.12}
              style={styles.mainButton}
              accessibilityLabel={run.paused ? t('run.resume') : t('run.pause')}
            >
              {run.paused ? <PlayIcon color={color} /> : <PauseIcon color={color} />}
            </PressBox>

            <ControlButton label={segLabel(run.next)} onPress={run.skipNext}>
              <NextIcon />
            </ControlButton>
          </View>

          {/* 전체 진행 바 — 노치를 피해 하단에 둔다 */}
          <View>
            <View style={styles.track}>
              <LinearGradient
                colors={['rgba(255,255,255,0.75)', '#FFFFFF']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ height: 6, width: `${barPct}%`, borderRadius: 3 }}
              />
            </View>
            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, TABULAR]}>
                {t('run.elapsed', { time: clock(run.elapsed) })}
              </Text>
              <Text style={[styles.barLabel, TABULAR]}>
                {t('run.total', { time: clock(run.total) })}
              </Text>
            </View>
          </View>
        </View>
      </View>
      </Animated.View>
    </Animated.View>
  );
}

/** 실행할 프리셋이 없을 때 — 홈으로 돌려보낸다 */
function MissingPreset() {
  const router = useRouter();
  useEffect(() => {
    router.dismissTo('/');
  }, [router]);
  return <View style={{ flex: 1, backgroundColor: C.bgPlain }} />;
}

function ControlButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressBox
      onPress={onPress}
      hitSlop={8}
      scaleTo={0.88}
      dim={0}
      style={styles.control}
      accessibilityLabel={label}
    >
      <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      {/* 언어에 따라 라벨 길이가 크게 달라진다. 줄바꿈 대신 살짝 줄여 한 줄을 지킨다 */}
      <Text style={styles.controlLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Text>
    </PressBox>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /** 접히면서 모서리가 둥글어진다 — 잘라내야 안쪽 그라디언트도 따라 둥글다 */
  card: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  tile: { width: 48, height: 48 },
  handleArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileGlyph: { fontSize: 20, color: '#FFFFFF', opacity: 0.9 },
  routineName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    opacity: 0.95,
  },
  blockRow: {
    paddingTop: 18,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
  },
  blockName: { fontSize: 15, color: '#FFFFFF' },
  blockNow: { fontWeight: '700', opacity: 1 },
  blockOther: { fontWeight: '600', opacity: 0.5 },
  ringWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  controls: { flexDirection: 'row', gap: 26, alignItems: 'center', justifyContent: 'center' },
  control: { width: 96, alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF', opacity: 0.8 },
  mainButton: {
    width: 96,
    height: 96,
    marginBottom: 19,
    borderRadius: 48,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.20)',
    overflow: 'hidden',
  },
  barLabels: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', opacity: 0.75 },
});
