/** 5.1 홈 — 운동 직전에 화면을 오래 붙들지 않게 한다. 실행까지 한 번의 탭. */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from '../src/components/Surface';
import { PressBox } from '../src/components/PressBox';
import { CalendarIcon, GearIcon, PlayIcon } from '../src/components/Icons';
import { useMiniTimerSpace } from '../src/components/MiniTimer';
import { Screen } from '../src/components/Screen';
import { Wordmark } from '../src/components/Wordmark';
import { presetSummary, presetTimeLine } from '../src/engine/labels';
import { totalSec } from '../src/engine/segments';
import { t } from '../src/i18n';
import { selectionTick } from '../src/feedback';
import { useSessionStable } from '../src/session';
import { useToast } from '../src/components/Toast';
import { sortPresets, useStore, type SortKey } from '../src/store';
import { C, E2, GUTTER, LIFT, RADIUS, TABULAR } from '../src/theme';
import { kindOf, type Preset, type PresetKind } from '../src/types';

const TABS: PresetKind[] = ['routine', 'timer'];

const SORT_LABEL: Record<SortKey, string> = {
  recent: 'list.sortRecent',
  name: 'list.sortName',
  created: 'list.sortCreated',
};

/**
 * 목록 행은 눌리는 카드다 — 안쪽 여백만큼 목록 자체를 바깥으로 물려서
 * 글자는 여전히 화면 좌우 여백(24)에 맞춘다.
 */
const ROW_PAD = 12;
const ROW_INSET = GUTTER - ROW_PAD;
const ROW_RADIUS = 18;

/** 재생 버튼 — 어두운 회색 원. 반경은 지름의 절반 */
const PLAY_SIZE = 60;

/** 추가 버튼 — 정렬 줄 오른쪽 끝에 앉는 작은 알약. 반경은 높이의 절반 */
const ADD_HEIGHT = 38;
const ADD_RADIUS = ADD_HEIGHT / 2;

/**
 * 정렬 줄은 목록 위에 떠 있고 행들은 그 뒤로 지나간다.
 *
 * 줄이 실제로 차지하는 높이는 글자 크기 설정에 따라 달라져서 재서 쓴다.
 * 첫 프레임에만 쓰이는 어림값(여백 18 + 줄 41 + 여백 18).
 */
const TOOL_ROW_PAD = 18;
const TOOL_ROW_GUESS = TOOL_ROW_PAD * 2 + 41;

export default function Home() {
  const router = useRouter();
  const session = useSessionStable();
  const miniSpace = useMiniTimerSpace();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { presets, ready, settings, setSettings, duplicatePreset, deletePreset } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<PresetKind>('routine');
  const [toolHeight, setToolHeight] = useState(TOOL_ROW_GUESS);
  const pager = useRef<ScrollView>(null);
  // 손가락으로 끄는 동안에만 탭 표시를 따라가게 한다. 첫 레이아웃 때 iOS가
  // 흘리는 스크롤 이벤트에 탭이 넘어가 버리는 것을 막는다.
  const swiping = useRef(false);

  const grouped = useMemo(() => {
    const sorted = sortPresets(presets, settings.sort);
    return {
      routine: sorted.filter((p) => kindOf(p) === 'routine'),
      timer: sorted.filter((p) => kindOf(p) === 'timer'),
    };
  }, [presets, settings.sort]);

  /** 정렬 — 기준을 돌려가며 고른다. 세 가지뿐이라 별도 화면을 열 이유가 없다 */
  const cycleSort = useCallback(() => {
    const order: SortKey[] = ['recent', 'name', 'created'];
    const next = order[(order.indexOf(settings.sort) + 1) % order.length];
    setSettings({ sort: next });
    selectionTick();
  }, [settings.sort, setSettings]);

  /** 행을 길게 누르면 — 복제 · 삭제 */
  const rowActions = useCallback(
    (preset: Preset) => {
      selectionTick();
      Alert.alert(preset.name, undefined, [
        {
          text: t('list.duplicate'),
          onPress: () => {
            duplicatePreset(preset.id);
            toast(t('toast.duplicated'));
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              t('list.deleteConfirmTitle', { name: preset.name }),
              t('list.deleteConfirmBody'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  style: 'destructive',
                  onPress: () => {
                    deletePreset(preset.id);
                    toast(t('toast.deleted'));
                  },
                },
              ]
            ),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [duplicatePreset, deletePreset, toast]
  );

  const empty = ready && grouped[tab].length === 0;

  /**
   * 앱을 다시 열었을 때 진행 중이던 타이머가 있으면 그 화면으로 돌아간다.
   * 앱이 백그라운드에서 정지됐다 살아난 경우가 여기 해당한다 —
   * 알림만 계속 울리고 앱에는 아무것도 없던 상태를 없앤다. 한 번만 한다.
   *
   * **저장소에서 되살아난 세션만** 연다. 예전에는 세션이 생기기만 하면 열었는데,
   * 그러면 목록의 ▶를 눌렀을 때 그 버튼과 여기가 각각 화면을 밀어 두 겹이 쌓였다.
   * 한 번 끌어내려도 밑에 깔린 실행 화면이 다시 나타나던 것이 그 때문이다.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !session.restoredFromStorage || !session.preset || session.done) return;
    restored.current = true;
    router.push('/run');
  }, [session.restoredFromStorage, session.preset, session.done, router]);

  /** 세그먼트 탭을 누르면 페이지를 옮긴다 — 스와이프와 같은 상태를 공유한다 */
  const goTab = useCallback(
    (k: PresetKind) => {
      if (k === tab) return;
      setTab(k);
      selectionTick();
      pager.current?.scrollTo({ x: TABS.indexOf(k) * width, animated: true });
    },
    [tab, width]
  );

  /** 반쯤 넘어가면 탭 표시가 따라온다 — 손가락을 떼기 전에 반응한다 */
  const onPagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!swiping.current || width <= 0) return;
      const next = TABS[Math.round(e.nativeEvent.contentOffset.x / width)];
      if (next && next !== tab) {
        setTab(next);
        selectionTick();
      }
    },
    [tab, width]
  );

  return (
    <Screen>
      {/*
        아래쪽은 비워두지 않는다 — 목록은 화면 끝까지 자라고, 홈 인디케이터와
        미니 바가 차지하는 만큼은 목록 **내용**의 끝에 붙인다(TabPage의 bottomPad).
        틀을 잘라 두면 스크롤하는 도중 행이 허공에서 잘리고, 그 아래 빈 띠가
        목록을 가리는 판처럼 보인다.
      */}
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.header}>
          {/* 잠금형이 넓고 낮아져서 118로는 심볼이 28px 아래로 떨어진다 */}
          <Wordmark width={140} />
          {/*
            머리줄 오른쪽 두 자리 — 기록과 설정. 둘 다 목록을 떠나 다른 데로 가는
            길이라 한데 모은다. 기록이 안쪽인 것은 더 자주 열기 때문이다.
          */}
          <View style={styles.headerActions}>
            <PressBox
              onPress={() => router.push('/records')}
              hitSlop={12}
              scaleTo={0.88}
              dim={0}
              accessibilityLabel={t('records.a11yOpen')}
            >
              <CalendarIcon size={26} color={C.textSecondary} />
            </PressBox>
            <PressBox
              onPress={() => router.push('/settings')}
              hitSlop={12}
              scaleTo={0.88}
              dim={0}
              accessibilityLabel={t('home.settings')}
            >
              <GearIcon size={28} color={C.textSecondary} />
            </PressBox>
          </View>
        </View>

        <Segmented
          tab={tab}
          onTab={goTab}
          routineCount={grouped.routine.length}
          timerCount={grouped.timer.length}
        />

        {/*
          목록과 그 위에 뜬 정렬 줄. 줄은 흐름에서 빼서 얹고, 목록은 줄 높이만큼
          위쪽 여백을 두고 시작한다 — 스크롤하면 행이 줄 뒤로 미끄러져 들어간다.
        */}
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentOffset={{ x: 0, y: 0 }}
            onScrollBeginDrag={() => {
              swiping.current = true;
            }}
            onScroll={onPagerScroll}
            onMomentumScrollEnd={(e) => {
              onPagerScroll(e);
              swiping.current = false;
            }}
            style={{ flex: 1 }}
          >
            {TABS.map((k) => (
              <TabPage
                key={k}
                kind={k}
                list={grouped[k]}
                width={width}
                ready={ready}
                topPad={toolHeight}
                bottomPad={insets.bottom + 12 + miniSpace}
                onRowActions={rowActions}
              />
            ))}
          </ScrollView>

          {/* 목록보다 뒤에 그린다 — 지나가는 행을 덮어야 하므로 */}
          <ToolRowBackdrop height={toolHeight} />

          {/* 정렬은 왼쪽, 추가는 오른쪽 — 목록을 다루는 두 손잡이가 한 줄에 있다 */}
          <View
            style={styles.toolRow}
            onLayout={(e) => setToolHeight(Math.round(e.nativeEvent.layout.height))}
          >
            <Pressable
              onPress={cycleSort}
              style={({ pressed }) => [styles.sortRow, pressed && styles.sortRowPressed]}
              hitSlop={{ top: 4, bottom: 4, left: GUTTER, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t(SORT_LABEL[settings.sort])}
            >
              <Text style={styles.sortText}>{t(SORT_LABEL[settings.sort])}</Text>
              <Text style={styles.sortChevron}>⇅</Text>
            </Pressable>

            <AddButton kind={tab} primary={empty} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

/**
 * 정렬 줄 뒤 — 흐린 판. 행이 이 아래로 미끄러져 들어가면서 흐려지다 사라진다.
 *
 * 한때 흐림을 접고 배경을 복사해 깔았다. 흐림 재질은 뒤에 아무것도 없어도 제가
 * 덮은 사각형만큼 색을 얹는데, 그때 배경이 세로 그라디언트라 그 균일한 색이
 * 어디에 놓이든 배경과 어긋나 아랫변이 가로선으로 읽혔기 때문이다.
 *
 * **그 전제가 사라졌다.** 배경이 단색이 되면서, 위쪽을 배경색으로 꽉 채워도 밑에
 * 깔린 진짜 배경과 픽셀이 정확히 같다. 그래서 두 겹으로 끝낸다 —
 *
 *   1) BlurView가 판 전체를 흐린다.
 *   2) 그 위에 배경색 스크림을 얹되 아래로 갈수록 걷는다.
 *
 * 정렬 줄과 추가 버튼이 앉는 위쪽은 스크림이 꽉 차 배경 그대로이고, 아래로 가면서
 * 열려 흐림만 남는다. 판이 끝나는 자리에서 행은 흐림에서 또렷함으로 건너가지만
 * 그때 스크림은 이미 투명이라 **색 경계가 생기지 않는다** — 옛 주석이 빠져나갈
 * 데가 없다고 적은 자리가 여기다.
 */
function ToolRowBackdrop({ height }: { height: number }) {
  return (
    <View style={[styles.backdrop, { height }]} pointerEvents="none">
      {/*
        안드로이드에서는 experimentalBlurMethod 없이 반투명 겹으로만 떨어진다.
        Sheet도 그 프로프 없이 쓰고 있어 같은 수준으로 맞춘다 — 여기만 실험
        옵션을 켜면 시트와 홈의 재질이 갈린다.
      */}
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[C.bgPlain, C.bgPlain, C.bgPlainClear]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function TabPage({
  kind,
  list,
  width,
  ready,
  topPad,
  bottomPad,
  onRowActions,
}: {
  kind: PresetKind;
  list: Preset[];
  width: number;
  ready: boolean;
  /** 위에 떠 있는 정렬 줄이 가리는 높이 */
  topPad: number;
  /** 화면 아래에서 홈 인디케이터와 미니 바가 가리는 높이 */
  bottomPad: number;
  onRowActions: (p: Preset) => void;
}) {
  return (
    <View style={{ width }}>
      {ready && list.length === 0 ? (
        <EmptyState kind={kind} topPad={topPad} bottomPad={bottomPad} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ROW_INSET,
            /**
             * 정렬 줄이 가리는 만큼만. 따로 더 띄우지 않는다 — 그 줄의 아래 여백이
             * 이미 숨통이고, 행 자체도 위아래 20씩 안고 있다.
             */
            paddingTop: topPad,
            paddingBottom: bottomPad,
          }}
          showsVerticalScrollIndicator={false}
        >
          {list.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <View style={styles.rowDivider} />}
              <PresetRow preset={p} onLongPress={() => onRowActions(p)} />
            </React.Fragment>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Segmented({
  tab,
  onTab,
  routineCount,
  timerCount,
}: {
  tab: PresetKind;
  onTab: (k: PresetKind) => void;
  routineCount: number;
  timerCount: number;
}) {
  const items: { key: PresetKind; label: string }[] = [
    { key: 'routine', label: t('home.tabRoutine', { count: routineCount }) },
    { key: 'timer', label: t('home.tabTimer', { count: timerCount }) },
  ];
  return (
    <Surface radius={RADIUS.tab} style={styles.segment}>
      <View style={styles.segmentInner}>
        {items.map((it) => {
          const on = it.key === tab;
          return (
            <Pressable
              key={it.key}
              onPress={() => onTab(it.key)}
              style={styles.segmentTab}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              {on && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: RADIUS.tile, backgroundColor: C.white },
                  ]}
                />
              )}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: on ? '700' : '600',
                  color: on ? C.onWhite : C.textSecondary,
                }}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Surface>
  );
}

function PresetRow({ preset, onLongPress }: { preset: Preset; onLongPress: () => void }) {
  const router = useRouter();
  const session = useSessionStable();
  const total = useMemo(() => totalSec(preset), [preset]);

  /**
   * ▶ — 이미 도는 타이머가 있으면 그 자리에서 갈아엎지 않는다.
   *
   * 같은 것이면 그냥 그 화면을 연다(다시 시작하면 진행이 날아간다).
   * 다른 것이면 무엇을 끝내고 무엇을 시작하는지 이름을 대고 묻는다 —
   * 되돌릴 수 없는 일이라 조용히 처리하면 안 된다.
   */
  const start = () => {
    const running = session.preset;

    if (running && !session.done) {
      if (running.id === preset.id) {
        router.push('/run');
        return;
      }
      Alert.alert(
        t('run.switchTitle'),
        t('run.switchBody', { running: running.name, next: preset.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('run.switchConfirm'),
            style: 'destructive',
            onPress: () => {
              session.start(preset.id);
              router.push('/run');
            },
          },
        ]
      );
      return;
    }

    session.start(preset.id);
    router.push('/run');
  };

  return (
    <PressBox
      onPress={() => router.push({ pathname: '/edit', params: { id: preset.id } })}
      onLongPress={onLongPress}
      radius={ROW_RADIUS}
      scaleTo={0.98}
      dim={0.22}
      style={styles.row}
      accessibilityLabel={t('home.a11yEdit', { name: preset.name })}
    >
      <View style={{ flex: 1, paddingRight: 14 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {preset.name}
        </Text>
        <Text style={[styles.rowSummary, TABULAR]} numberOfLines={1}>
          {presetSummary(preset)}
        </Text>
        <Text
          style={[styles.rowTime, TABULAR]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {presetTimeLine(preset, total)}
        </Text>
      </View>

      {/*
        안쪽의 독립 버튼 — 여기를 누르면 행 전체가 아니라 이 버튼만 반응한다.

        누르면 배경이 한 단계 밝아진다. 덮는 색이 검정이 아니라 옅은 흰색인 이유는,
        이미 어두운 회색 원이라 검정을 덮어봐야 눌린 티가 나지 않기 때문이다.
      */}
      <PressBox
        onPress={start}
        haptic="commit"
        radius={PLAY_SIZE / 2}
        scaleTo={0.92}
        dim={1}
        dimColor="rgba(255,255,255,0.13)"
        style={styles.playButton}
        accessibilityLabel={t('home.a11yStart', { name: preset.name })}
      >
        {/* ▶ 광학 보정은 PlayIcon 안에 들어 있다 */}
        <PlayIcon size={20} />
      </PressBox>
    </PressBox>
  );
}

/** 빈 화면은 정렬 줄과 미니 바 사이, 남은 자리의 한가운데에 선다 */
function EmptyState({
  kind,
  topPad,
  bottomPad,
}: {
  kind: PresetKind;
  topPad: number;
  bottomPad: number;
}) {
  return (
    <View style={[styles.empty, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <Surface radius={32} style={styles.emptyIcon}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PlayIcon size={30} color="rgba(255,255,255,0.55)" />
        </View>
      </Surface>
      <Text style={styles.emptyTitle}>
        {kind === 'routine' ? t('home.emptyRoutineTitle') : t('home.emptyTimerTitle')}
      </Text>
      <Text style={styles.emptyBody}>
        {kind === 'routine' ? t('home.emptyRoutineBody') : t('home.emptyTimerBody')}
      </Text>
    </View>
  );
}

function AddButton({ kind, primary }: { kind: PresetKind; primary: boolean }) {
  const router = useRouter();
  const label = kind === 'routine' ? t('home.newRoutine') : t('home.newTimer');
  const go = () => router.push({ pathname: '/edit', params: { kind } });

  /**
   * 알약 안에 ＋와 라벨이 나란히 선다. 정렬 줄에 얹히는 작은 버튼이라 예전처럼
   * ＋를 왼쪽 끝에 절대 배치하지 않는다 — 폭이 글자 길이를 따라 줄었다 늘었다 한다.
   */
  const inner = (color: string, weight: '600' | '700') => (
    <View style={styles.addInner}>
      {/* 전각 ＋는 em 박스 안에서 작게 그려진다 — 눈에 보이려면 글자보다 훨씬 키워야 한다 */}
      <Text style={[styles.addPlus, { color }]}>＋</Text>
      <Text style={{ fontSize: 14, fontWeight: weight, color }}>{label}</Text>
    </View>
  );

  if (primary) {
    return (
      <PressBox
        onPress={go}
        radius={ADD_RADIUS}
        scaleTo={0.95}
        dim={0.14}
        style={[styles.addPill, LIFT]}
        accessibilityLabel={label}
      >
        <View
          style={[StyleSheet.absoluteFill, { borderRadius: ADD_RADIUS, backgroundColor: C.white }]}
        />
        {inner(C.onWhite, '700')}
      </PressBox>
    );
  }

  return (
    <PressBox onPress={go} radius={ADD_RADIUS} scaleTo={0.95} dim={0.22} accessibilityLabel={label}>
      <Surface radius={ADD_RADIUS} style={styles.addPill}>
        {inner(C.textPrimary, '600')}
      </Surface>
    </PressBox>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  header: {
    height: 64,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: { fontSize: 34, fontWeight: '800', letterSpacing: -1.19, color: C.textPrimary },
  segment: { marginTop: 16, marginHorizontal: GUTTER, height: 58, padding: 5 },
  segmentInner: { flex: 1, flexDirection: 'row', gap: 5 },
  segmentTab: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /**
   * 글자만 놓으면 누를 수 있는 높이가 18pt뿐이라 잘 안 눌린다.
   * 위아래 여백을 실제로 넣어 손가락이 닿는 넓이를 확보하고, 그만큼 바깥 여백을
   * 줄여 글자 자리는 그대로 둔다. 위쪽 여백은 세그먼트 아래 빈 곳이라 온전히 쓰이고,
   * 아래쪽은 목록이 조금 겹친다 — hitSlop이 아니라 padding이어야 하는 이유다.
   */
  /**
   * 정렬(왼쪽)과 추가(오른쪽)가 나란한 줄.
   * 세그먼트 쪽으로는 넉넉히 띄우고 목록 쪽으로는 붙인다 — 이 줄은 목록을 다루는
   * 손잡이라 목록에 딸려 보여야 한다.
   *
   * 목록 위에 떠 있으므로 위아래 간격은 margin이 아니라 padding으로 준다 —
   * 이 줄이 가리는 높이를 그대로 재서 목록의 시작 여백으로 넘겨야 한다.
   * 위아래를 같은 값으로 둔다. 흐린 판이 이 줄만큼이라, 여백이 한쪽으로 쏠리면
   * 판 안에서 줄이 위로 붙어 보인다.
   */
  toolRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: TOOL_ROW_PAD,
    paddingBottom: TOOL_ROW_PAD,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** 흐림 재질이 틀 밖으로 새지 않게 잘라낸다 */
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  sortRow: {
    paddingVertical: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sortRowPressed: { opacity: 0.5 },
  sortText: { fontSize: 14, fontWeight: '600', color: C.textTertiary },
  sortChevron: { fontSize: 14, color: C.textTertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: ROW_PAD,
    borderRadius: ROW_RADIUS,
  },
  rowDivider: { height: 1, marginHorizontal: ROW_PAD, backgroundColor: C.divider },
  /**
   * 세 줄 모두 높이를 못 박는다. lineHeight만 주면 문자열 구성에 따라 폰트가
   * 갈리면서(한글만 있는 "타바타"는 22, 공백이 섞인 "전신 서킷"은 26.3) 줄
   * 단위 반올림이 달라져 행 키가 어긋난다. 한 줄로 고정된 자리라 height가 맞다.
   */
  rowName: {
    fontSize: 22,
    lineHeight: 28,
    height: 28,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  rowSummary: { marginTop: 7, fontSize: 15, lineHeight: 20, height: 20, color: C.textSecondary },
  rowTime: { marginTop: 5, fontSize: 15, lineHeight: 20, height: 20, color: C.textTertiary },
  playButton: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: GUTTER },
  emptyIcon: { width: 96, height: 96 },
  emptyTitle: { marginTop: 22, fontSize: 20, fontWeight: '700', color: C.textPrimary },
  emptyBody: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    color: C.textSecondary,
  },
  addPill: {
    height: ADD_HEIGHT,
    borderRadius: ADD_RADIUS,
    overflow: 'hidden',
  },
  addInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    gap: 2,
  },
  /** 전각 ＋는 글리프가 em 박스보다 한참 작다. lineHeight로 세로 중심을 잡는다 */
  addPlus: { fontSize: 26, fontWeight: '300', lineHeight: 30, marginTop: -1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
