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
import { RunMoreSheet } from '../src/components/RunMoreSheet';
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

/**
 * 진행 막대를 둘러싼 네 개의 글자는 같은 크기다 — 막대 위의 "3 / 9 구간"·"순서
 * 바꾸기", 아래의 경과·총 시간. 넷 다 막대를 읽는 곁말이라 하나가 크면 그것만
 * 제목처럼 도드라진다. 위계는 크기가 아니라 불투명도로 준다.
 */
const BAR_LABEL = 14;
/** 막대와 그 위아래 줄 사이 — 한 값으로만 준다. 막대가 두 줄 한가운데 선다 */
const BAR_GAP = 11;
/**
 * 컨트롤 줄과 진행 막대 사이. 둘은 하는 일이 다르다 — 위는 손을 대는 곳,
 * 아래는 읽는 곳이다. 막대 안쪽 여백(BAR_GAP)보다 넉넉히 벌려야 두 덩이로 읽힌다.
 */
const CONTROLS_GAP = 42;

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
  const [more, setMore] = useState(false);
  /** 「더보기」에서 고른 것 — 시트가 다 내려간 뒤에 실행한다 */
  const pending = useRef<'order' | 'skip' | null>(null);
  /**
   * 시트가 떠 있는가 — 아래 화면의 끌어내리기가 이걸 보고 비켜선다.
   *
   * **RN의 손짓 협상은 네이티브 뷰 계층이 아니라 React 트리를 따라 올라간다.**
   * 시트는 Modal이라 화면상으로는 완전히 분리된 겹인데, JSX에서는 이 화면
   * 안쪽에 있어서 시트 안에서 내리긋는 손짓이 그대로 이 화면의 PanResponder까지
   * 버블한다 — 목록을 훑어 내리려다 타이머가 접혀 닫히던 것이 그것이다.
   *
   * useMemo 밖의 ref로 읽는다. 상태를 의존성에 넣으면 시트를 여닫을 때마다
   * PanResponder가 새로 만들어져 쥐고 있던 손짓이 끊긴다.
   */
  const sheetUp = useRef(false);
  sheetUp.current = ordering || more;
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
  const doneParams = () => {
    const { lived, recordId } = run.settle();
    return {
      id: preset!.id,
      // 계획상의 위치가 아니라 실제로 지나온 몫 — 넘긴 구간은 빠져 있다
      lived: JSON.stringify(lived),
      // 종목별 몫과 구간 이력은 기록에 이미 들어 있다 — 열쇠만 넘긴다
      record: recordId ?? '',
      full: run.done ? '1' : '',
      orders: run.orders ? JSON.stringify(run.orders) : '',
      skips: run.skips ? JSON.stringify(run.skips) : '',
    };
  };

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
          // 시트가 떠 있으면 이 화면은 손짓을 받지 않는다 — 트리에서 뺀 것에 더해 한 겹 더
          !sheetUp.current &&
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
  /** 링 밖(이름·메모)과 링 안(단계말)이 나눠 쓴다 */
  const title = ringTitle(run.seg, run.paused, preset);

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
    // 끌어내려 닫을 때와 같이 문지방을 찍는다 — 접히자마자 드러난 미니 바가
    // 늦게 도착한 손짓에 눌려 편집 화면 **위에** 실행 화면을 다시 쌓지 않게
    morph.collapsedAt.current = Date.now();
    morph.animate(1, {
      duration: 260,
      onDone: () => {
        /*
          두 라우팅을 **다른 커밋으로** 쪼갠다.

          한 tick에 부르면 expo-router가 둘을 연달아 dispatch하고 React가 하나의
          커밋으로 묶는다. 그러면 iOS가 "모달(이 화면)을 해제하면서 동시에 같은
          스택에 새 화면을 push"하는 꼴이 되어, 해제 트랜지션과 push가 겹치는
          동안 잔여 레이어가 창에 남는다 — 화면은 그려지는데 터치만 먹지 않는다.
        */
        router.dismissTo('/');
        requestAnimationFrame(() => {
          router.push({ pathname: '/edit', params: { id } });
        });
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
  const prevLabel = prevSeg ? segLabel(prevSeg, run.seg, preset) : t('run.prevRestart');

  return (
    /*
      위에서 아래로 끌어내리면 접혀서 하단 미니 바가 된다 — 타이머는 계속 돈다.

      겹이 둘인 이유: 자리·크기·투명도는 네이티브 드라이버로 돌고, 모서리 반경은
      JS 쪽에서 돌아야 한다. 한 겹에 섞으면 RN이 거부한다.
    */
    <>
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
          시안 「링 위 5a: 이름이 주인공」 — 종목 이름(두 줄까지)과 메모는 머리줄
          바로 아래, 링 밖에 선다. "뭘 하는지"를 먼저 읽고 시선이 타이머로
          내려가는 순서다. 링 안에는 단계말 하나만 남는다.

          이 블록은 **높이가 고정**이다. 이름 없는 단계(웜업·준비·쿨다운·라운드
          휴식·완료)에서 블록이 접히면 링이 단계마다 오르내린다 — 링 자리는 모든
          단계에서 같아야 한다. 두 줄 이름+메모가 서는 최악 높이로 잡되, 그 이상
          키우지 않아 이름 없는 단계의 위쪽이 휑해 보이지 않게 한다.
        */}
        <View style={styles.nameBlock}>
          {title.name != null && (
            <>
              <Text numberOfLines={2} style={styles.exName}>
                {title.name}
              </Text>
              {title.memo != null && (
                <Text numberOfLines={1} style={styles.exMemo}>
                  “{title.memo}”
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.ringWrap}>
          <Ring
            ratio={run.ratio}
            remainSec={run.remain}
            durSec={run.seg?.dur ?? 0}
            title={title.rest}
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
        <View onLayout={measureControls} style={{ paddingHorizontal: GUTTER, gap: CONTROLS_GAP }}>
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
              <MainGlyph color={color} paused={run.paused} />
            </PressBox>

            <ControlButton label={segLabel(run.next, run.seg, preset)} onPress={run.skipNext}>
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
          <View style={{ gap: BAR_GAP }}>
            <View style={styles.stageRow}>
              <Text style={[styles.stageCount, TABULAR]}>
                {t('run.stageOf', {
                  i: Math.min(stages.length, Math.max(1, cursor + 1)),
                  n: stages.length,
                })}
              </Text>
              {!simple && (
                <PressBox
                  onPress={() => setMore(true)}
                  hitSlop={12}
                  scaleTo={0.94}
                  dim={0}
                  accessibilityLabel={t('run.moreTitle')}
                >
                  <Text style={styles.stageLink}>{t('run.more')} ›</Text>
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
                      <View
                        style={[styles.tickFill, { width: `${filled * 100}%` }]}
                        pointerEvents="none"
                      />
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

      </Animated.View>
      </Animated.View>

      {/*
        시트는 끌어내리기를 받는 겹 **바깥**에 둔다.

        RN에서 손짓의 주인을 정하는 협상은 네이티브 뷰 계층이 아니라 **React
        트리**를 따라 올라간다. 시트는 Modal이라 화면에서는 완전히 떨어진 겹인데,
        JSX에서 저 안에 있으면 시트 안의 손짓이 조상인 이 화면까지 닿는다 —
        목록을 훑어 내리다 타이머가 접히던 것이 그것이다.

        형제로 두면 올라갈 길 자체가 없다. 시트는 Modal이라 어디에 적든 화면
        맨 위에 뜨므로 보이는 것은 달라지지 않는다.
      */}
      {/*
        「더보기」에서 고른 것은 시트가 **완전히 내려간 뒤에** 실행한다.

        순서 시트도 Modal이라, 닫는 것과 여는 것이 같은 프레임에 겹치면 iOS가
        뒤엣것을 아예 띄우지 않고 앞엣것의 투명한 껍데기만 남긴다 — 아무것도 안
        보이는데 화면 전체가 안 눌리는 그 상태다. 실행 화면이 투명 모달 라우트라
        그 위에서는 모달이 한 번에 하나뿐이다.
      */}
      <RunMoreSheet
        visible={more}
        onClose={() => setMore(false)}
        onReorder={() => {
          pending.current = 'order';
          setMore(false);
        }}
        onSkipBlock={() => {
          pending.current = 'skip';
          setMore(false);
        }}
        canSkipBlock={run.canSkipBlock}
        onClosed={() => {
          const what = pending.current;
          pending.current = null;
          if (what === 'order') setOrdering(true);
          else if (what === 'skip') run.skipBlock();
        }}
      />

      <OrderSheet
        visible={ordering}
        onClose={() => setOrdering(false)}
        blocks={orderBlocks}
        lockedCount={run.lockedCount}
        skipped={run.roundSkips}
        onReorder={run.reorder}
        onSkipped={run.setSkipped}
      />
    </>
  );
}

/**
 * 가운데 버튼 안의 글리프 — 페이즈가 바뀌면 배경과 **같은 속도로** 색이 건너간다.
 *
 * 흰 버튼 위의 색은 화면에서 페이즈 색이 가장 진하게 남는 자리다. 배경은 0.6초에
 * 걸쳐 녹아드는데 이것만 톡 갈아끼우면 그 순간이 튄다. RN에는 색 전환이 없으니
 * 같은 글리프를 두 겹으로 겹쳐 놓고 위 겹을 걷어낸다.
 *
 * **새 색은 반드시 보이지 않는 겹에 먼저 칠한다.** 위 겹이 늘 아래를 완전히 덮고
 * 있어서, 아래에 새 색을 칠하는 것은 화면에 아무 일도 일으키지 않는다. 그런 뒤
 * 위 겹을 서서히 벗기면 새 색이 드러난다.
 *
 * 반대로 하면(보이는 겹에 새 색을 칠하고 투명도를 0으로 되돌리면) 그 되돌림이
 * 한 프레임 늦게 닿는 순간 새 색이 그대로 번쩍인다 — 초록에서 빨강이 한 번
 * 튀었다가 초록으로 돌아온 뒤 다시 빨강으로 넘어가던 것이 그것이다.
 *
 * 두 겹의 불투명도 합이 늘 1이라 건너가는 동안 글리프가 옅어지지도 않는다.
 * 모양(▶/⏸)은 건너가지 않는다. 누른 결과라 즉시 바뀌어야 손에 붙는다.
 */
function MainGlyph({ color, paused }: { color: string; paused: boolean }) {
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
   * 화면에는 아무 변화가 없다. (마운트 때 한 번 더 도는 것은 무해하다)
   */
  useEffect(() => {
    fade.setValue(1);
  }, [over, fade]);

  const Glyph = paused ? PlayIcon : PauseIcon;
  return (
    <View>
      <Glyph color={under} />
      {/* 같은 글리프를 같은 자리에 겹친다 — 크기도 여백도 같아 정확히 포개진다 */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, opacity: fade }}>
        <Glyph color={over} />
      </Animated.View>
    </View>
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
    opacity: 0.9,
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
  stageCount: { fontSize: BAR_LABEL, fontWeight: '600', color: '#FFFFFF', opacity: 0.88 },
  stageLink: { fontSize: BAR_LABEL, fontWeight: '600', color: '#FFFFFF', opacity: 0.78 },
  /**
   * 머리줄 아래 종목 이름·메모의 자리 — **높이 고정.** 이름 없는 단계에서도 같은
   * 높이를 지켜 링이 단계마다 오르내리지 않는다.
   *
   * 예약은 **한 줄 이름 + 메모**(12+28+5+18=63) 기준이다. 두 줄 기준(91)으로
   * 잡았더니 링이 너무 내려간다는 피드백 — 링 위쪽에는 어차피 유동 여백이
   * 있어서, 드문 두 줄 이름이 아래로 살짝 넘쳐도 링을 밀지 않고 그 여백을
   * 먹을 뿐이다(상자는 자르지 않는다).
   */
  nameBlock: {
    height: 63,
    paddingTop: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  exName: {
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  /** 이름 밑 메모 — 따옴표로 감싼 곁말. 시안의 "팔꿈치 45도…" 줄이다 */
  exMemo: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.78,
  },
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
  tick: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.20)' },
  /**
   * 지금 지나는 자리 — 두껍고, 바탕도 옅게 밝다. 흰 것은 차오른 만큼만이다.
   *
   * 바탕을 밝히는 것은 **차오름이 0일 때도 여기가 지금임이 읽혀야** 하기 때문이다.
   * 그 자리를 최소 폭으로 메우면 안 된다 — 짧은 자리에서 진행을 부풀린다.
   */
  tickNow: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.20)' },
  /**
   * 그 안에서 차오르는 흰 부분.
   *
   * 폭은 지난 시간에 정확히 비례한다. 최소 폭을 주면 10초짜리 자리에서 1초가
   * 3분의 2로 보인다 — 눈금 전체가 15pt인데 캡슐 하나가 10pt다.
   */
  tickFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  /** 지나온 자리 */
  tickDone: { backgroundColor: 'rgba(255,255,255,0.85)' },
  /*
    막대 아래 줄. 위아래 여백은 감싸는 상자의 gap 하나로만 준다 — 여기에 마진을
    더하면 막대가 두 줄 사이 한가운데 서지 않는다. 글자 크기도 위쪽 줄과 같은 BAR_LABEL.
  */
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: BAR_LABEL, fontWeight: '600', color: '#FFFFFF', opacity: 0.75 },
});
