/** 5.6 실행 화면 — 이 앱의 심장 */
import { useFocusEffect, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FloodTile } from '../src/components/Surface';
import { PressBox } from '../src/components/PressBox';
import { NextIcon, PauseIcon, PencilIcon, PlayIcon, PrevIcon } from '../src/components/Icons';
import { OrderSheet } from '../src/components/OrderSheet';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { Ring } from '../src/components/Ring';
import { clock, isSimple, phaseLabel, ringTitle, segLabel, subLabel } from '../src/engine/labels';
import { useMorph } from '../src/morph';
import { ensurePermission } from '../src/notify';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { C, GUTTER, PHASE_COLOR, TABULAR } from '../src/theme';

/**
 * 가운데 재생/일시정지 버튼의 지름. 양옆 이전·다음의 아이콘 칸도 같은 키로 둔다 —
 * 그래야 세 글리프의 중심이 한 줄에 선다. 라벨은 그 아래로 떨어진다.
 */
const MAIN_BUTTON = 100;

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
  const [ordering, setOrdering] = useState(false);
  useEffect(() => {
    void ensurePermission();
  }, []);

  /**
   * 이 운동이 지나가는 자리들 — 웜업 · 준비 · 종목(라운드마다 다시) · 쿨다운.
   *
   * 계획에서 뽑는다. 프리셋이 아니라 **실제로 돌 차례**여야 하고, 그건 실행 중에
   * 바뀔 수 있기 때문이다. 휴식은 자리로 세지 않는다 — 어디에서 어디로 가는
   * 사이일 뿐이라, 그 동안에는 **도착할** 자리를 지금으로 친다.
   */
  const { stages, stageOf } = useMemo(() => {
    const segs = run.plan?.segs ?? [];
    const stages: { key: string; name: string; start: number; end: number }[] = [];
    const stageOf: number[] = [];
    let occ = '';
    segs.forEach((s, i) => {
      switch (s.phase) {
        case 'WARMUP':
        case 'PREPARE':
        case 'COOLDOWN':
          if (stages[stages.length - 1]?.key !== s.phase) {
            stages.push({ key: s.phase, name: phaseLabel(s.phase), start: s.start, end: s.start });
          }
          break;
        case 'WORK': {
          const key = `${s.round}-${s.blk}`;
          if (key !== occ) {
            occ = key;
            stages.push({ key, name: s.name ?? '', start: s.start, end: s.start });
          }
          break;
        }
      }
      // 종목·라운드 사이 휴식은 아직 만들어지지 않은 다음 자리를 가리킨다
      const ahead = s.phase === 'BLOCK_REST' || s.phase === 'ROUND_REST';
      stageOf[i] = Math.min(stages.length - 1, ahead ? stages.length : stages.length - 1);
    });

    /**
     * 자리마다 시간 폭을 매긴다 — 하단 눈금이 이 폭으로 나뉜다.
     * 어느 초도 빠지지 않아야 눈금이 진행 바 노릇을 한다. 휴식은 도착할 자리에
     * 얹혀 있으므로, 자리의 폭은 그 자리에 속한 구간들의 처음부터 끝까지다.
     */
    segs.forEach((s, i) => {
      const k = stageOf[i];
      if (k < 0 || !stages[k]) return;
      stages[k].start = Math.min(stages[k].start, s.start);
      stages[k].end = Math.max(stages[k].end, s.start + s.dur);
    });

    return { stages, stageOf };
  }, [run.plan]);

  /** 그중 지금 자리. 다 끝났으면 끝을 가리킨다 */
  const cursor = run.seg ? (stageOf[run.idx] ?? -1) : stages.length;

  /** 순서 시트에 늘어놓을 종목 — 손댈 수 있는 라운드의 차례대로 */
  const orderBlocks = useMemo(
    () =>
      run.roundOrder
        .map((id) => preset?.blocks.find((b) => b.id === id))
        .filter((b) => !!b),
    [run.roundOrder, preset]
  );

  useEffect(() => {
    if (!settings.keepScreenOn) return;
    void activateKeepAwakeAsync('intava-run');
    return () => {
      void deactivateKeepAwake('intava-run');
    };
  }, [settings.keepScreenOn]);

  /**
   * 완료 화면으로 넘길 것 — 끝까지 갔든 도중에 껐든 같은 것을 넘긴다.
   *
   * 세션이 아니라 **파라미터로** 넘기는 이유: 완료 화면은 뜨자마자 세션을 비운다
   * (미니 바가 남으면 안 되니까). 그때 바꾼 차례도 같이 사라지면, 나중에 홈으로를
   * 누를 때 루틴에 저장할 것이 남아 있지 않다.
   */
  const doneParams = () => ({
    id: preset!.id,
    // 계획상의 위치가 아니라 실제로 지나온 몫 — 넘긴 구간은 빠져 있다
    lived: JSON.stringify(run.settle()),
    full: run.done ? '1' : '',
    orders: run.orders ? JSON.stringify(run.orders) : '',
  });

  // 전체가 끝나면 완료 화면으로 — 세션은 완료 화면에서 정리한다
  useEffect(() => {
    if (!run.done || !preset) return;
    router.replace({ pathname: '/done', params: doneParams() });
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
          /*
            도중에 끄더라도 완료 화면을 지난다 — 여기까지 얼마나 했는지 보여주고,
            바꾼 종목 차례를 루틴에 남길지 묻는 자리가 거기다. 세션은 완료 화면이
            정리한다(예전에는 여기서 stop()을 불렀다).
          */
          router.replace({ pathname: '/done', params: doneParams() });
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

        {/*
          종목 줄 — 이전 · 지금 · 다음 셋만. 종목이 여덟이면 이름이 두 줄로 접히면서
          링이 밀려 내려갔고, 그 여덟 개가 다 필요한 순간도 없었다. 전체 차례와
          순서 바꾸기는 오른쪽 목록 버튼 뒤에 둔다.
        */}
        <View style={styles.ringWrap}>
          <Ring
            ratio={run.ratio}
            remainSec={run.remain}
            durSec={run.seg?.dur ?? 0}
            title={ringTitle(run.seg, run.paused, preset)}
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
        <View onLayout={measureControls} style={{ paddingHorizontal: GUTTER, gap: 26 }}>
          <View style={styles.controls}>
            <ControlButton label={prevLabel} onPress={run.skipPrev}>
              <PrevIcon size={34} />
            </ControlButton>

            <PressBox
              onPress={run.toggle}
              haptic="commit"
              radius={48}
              scaleTo={0.93}
              dim={0.12}
              style={styles.mainButton}
              accessibilityLabel={run.paused ? t('run.resume') : t('run.pause')}
            >
              {run.paused ? <PlayIcon color={color} /> : <PauseIcon color={color} />}
            </PressBox>

            <ControlButton label={segLabel(run.next)} onPress={run.skipNext}>
              <NextIcon size={34} />
            </ControlButton>
          </View>

          {/*
            전체 진행 바 — 구간 눈금. 한 줄로 이어진 막대는 "얼마나 남았나"만
            말하는데, 자리마다 끊어 두면 **몇 번째를 지나고 있는지**가 같이 읽힌다.
            눈금의 폭은 그 자리가 걸리는 시간에 비례한다.

            "3 / 9 구간"은 이 막대 바로 위에 둔다. 머리줄 밑에 있을 때는 제목의
            부제처럼 읽혔는데, 그 말이 가리키는 것은 여기 이 막대다.
          */}
          <View style={{ gap: 11 }}>
            <View style={styles.stageRow}>
              <Text style={[styles.stageCount, TABULAR]}>
                {t('run.stageOf', {
                  i: Math.min(stages.length, Math.max(1, cursor + 1)),
                  n: stages.length,
                })}
              </Text>
              {!simple && (
                <PressBox
                  onPress={() => setOrdering(true)}
                  hitSlop={12}
                  scaleTo={0.94}
                  dim={0}
                  accessibilityLabel={t('run.orderTitle')}
                >
                  <Text style={styles.stageLink}>{t('run.reorder')} ›</Text>
                </PressBox>
              )}
            </View>
            <View style={styles.track}>
              {stages.map((s, i) => {
                const dur = Math.max(0.001, s.end - s.start);
                const filled = Math.max(0, Math.min(1, (run.elapsed - s.start) / dur));
                const now = i === cursor;
                return (
                  <View
                    key={s.key}
                    style={[
                      styles.tick,
                      { flex: dur },
                      now && styles.tickNow,
                      !now && filled >= 1 && styles.tickDone,
                    ]}
                  >
                    {now && filled > 0 && (
                      <View style={[styles.tickFill, { width: `${filled * 100}%` }]} />
                    )}
                  </View>
                );
              })}
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

      <OrderSheet
        visible={ordering}
        onClose={() => setOrdering(false)}
        blocks={orderBlocks}
        lockedCount={run.lockedCount}
        onReorder={run.reorder}
      />
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
      haptic="tap"
      hitSlop={8}
      scaleTo={0.88}
      dim={0}
      style={styles.control}
      accessibilityLabel={label}
    >
      <View style={styles.controlIcon}>{children}</View>
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
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  /**
   * 머리줄 아래 한 줄 — 몇 번째 자리를 지나는지와 순서를 바꾸는 길.
   *
   * 예전에는 이름 셋(이전·지금·다음)을 상자에 담아 두었는데, 지금 하는 것은
   * 링이 이미 크게 말하고 다음은 컨트롤 위에 적힌다. 같은 말을 세 군데서 하는
   * 대신 여기서는 **전체 중 어디쯤인지**만 말한다.
   */
  /** 막대 바로 위 — 왼쪽은 지금 몇 번째인지, 오른쪽은 순서를 바꾸는 길 */
  stageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageCount: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', opacity: 0.88 },
  stageLink: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', opacity: 0.78 },
  ringWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  controls: {
    flexDirection: 'row',
    gap: 26,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  /** 땀난 손으로 누르는 것이 이 둘이다 — 배경은 그대로 두고 글리프와 라벨만 키웠다 */
  control: { width: 92, alignItems: 'center' },
  /** 아이콘 칸 — 가운데 버튼과 같은 키라 세 글리프가 한 줄에 선다 */
  controlIcon: { height: MAIN_BUTTON, alignItems: 'center', justifyContent: 'center' },
  controlLabel: {
    /*
      아이콘 칸은 가운데 버튼과 키를 맞추느라 100이라, 글리프(27) 아래로 빈 자리가
      한참 남는다. 그대로 두면 라벨이 아이콘에서 떨어져 어느 버튼의 말인지 흐려진다.
      칸은 그대로 두고 라벨만 끌어올려 아이콘에 붙인다.
    */
    marginTop: -24,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.88,
  },
  mainButton: {
    width: MAIN_BUTTON,
    height: MAIN_BUTTON,
    borderRadius: MAIN_BUTTON / 2,
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
  track: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 10 },
  /** 눈금 하나 — 폭은 그 자리가 걸리는 시간에 비례한다 */
  tick: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.20)', overflow: 'hidden' },
  /** 지금 지나는 자리만 두껍고 빛난다 — 숫자를 읽기 전에 어디쯤인지 보인다 */
  tickNow: {
    height: 10,
    borderRadius: 5,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  /** 지나온 자리 */
  tickDone: { backgroundColor: 'rgba(255,255,255,0.85)' },
  tickFill: { height: '100%', borderRadius: 5, backgroundColor: '#FFFFFF' },
  barLabels: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', opacity: 0.75 },
});
