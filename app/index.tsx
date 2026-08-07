/** 5.1 홈 — 운동 직전에 화면을 오래 붙들지 않게 한다. 실행까지 한 번의 탭. */
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
import { GearIcon, PlayIcon } from '../src/components/Icons';
import { useMiniTimerSpace } from '../src/components/MiniTimer';
import { Screen } from '../src/components/Screen';
import { Wordmark } from '../src/components/Wordmark';
import { presetSummary, presetTimeLine } from '../src/engine/labels';
import { totalSec } from '../src/engine/segments';
import { t } from '../src/i18n';
import { selectionTick } from '../src/feedback';
import { useSession } from '../src/session';
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

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const miniSpace = useMiniTimerSpace();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { presets, ready, settings, setSettings, duplicatePreset, deletePreset } = useStore();
  const [tab, setTab] = useState<PresetKind>('routine');
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
        { text: t('list.duplicate'), onPress: () => duplicatePreset(preset.id) },
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
                  onPress: () => deletePreset(preset.id),
                },
              ]
            ),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [duplicatePreset, deletePreset]
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
    <Screen gradient>
      <View
        style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 + miniSpace }}
      >
        <View style={styles.header}>
          {/* 잠금형이 넓고 낮아져서 118로는 심볼이 28px 아래로 떨어진다 */}
          <Wordmark width={140} />
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

        <Segmented
          tab={tab}
          onTab={goTab}
          routineCount={grouped.routine.length}
          timerCount={grouped.timer.length}
        />

        {/* 정렬은 왼쪽, 추가는 오른쪽 — 목록을 다루는 두 손잡이가 한 줄에 있다 */}
        <View style={styles.toolRow}>
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
              onRowActions={rowActions}
            />
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

function TabPage({
  kind,
  list,
  width,
  ready,
  onRowActions,
}: {
  kind: PresetKind;
  list: Preset[];
  width: number;
  ready: boolean;
  onRowActions: (p: Preset) => void;
}) {
  return (
    <View style={{ width, paddingTop: 4 }}>
      {ready && list.length === 0 ? (
        <EmptyState kind={kind} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: ROW_INSET, paddingBottom: 12 }}
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
  const session = useSession();
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

function EmptyState({ kind }: { kind: PresetKind }) {
  return (
    <View style={styles.empty}>
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
   * 손잡이라 목록에 딸려 보여야 한다. 아래 간격은 TabPage의 paddingTop이 맡는다.
   */
  toolRow: {
    marginTop: 18,
    marginBottom: 2,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
