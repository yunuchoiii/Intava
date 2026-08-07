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

/** 추가 버튼 — 알약 모양이라 반경은 높이의 절반 */
const ADD_HEIGHT = 68;
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
   * 앱을 다시 열었을 때 진행 중인 타이머가 있으면 그 화면으로 돌아간다.
   * 앱이 백그라운드에서 정지됐다 살아난 경우가 여기 해당한다 —
   * 알림만 계속 울리고 앱에는 아무것도 없던 상태를 없앤다. 한 번만 한다.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !session.preset || session.done) return;
    restored.current = true;
    router.push('/run');
  }, [session.preset, session.done, router]);

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
          <Wordmark width={118} />
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

        <Pressable onPress={cycleSort} style={styles.sortRow} hitSlop={8}>
          <Text style={styles.sortText}>{t(SORT_LABEL[settings.sort])}</Text>
          <Text style={styles.sortChevron}>⇅</Text>
        </Pressable>

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

        <View style={{ paddingHorizontal: GUTTER, paddingTop: 12 }}>
          <AddButton kind={tab} primary={empty} />
        </View>
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
    <View style={{ width, paddingTop: 14 }}>
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

  const start = () => {
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

      {/* 안쪽의 독립 버튼 — 여기를 누르면 행 전체가 아니라 이 버튼만 반응한다 */}
      <PressBox
        onPress={start}
        radius={30}
        scaleTo={0.92}
        dim={0.16}
        style={styles.playButton}
        accessibilityLabel={t('home.a11yStart', { name: preset.name })}
      >
        <View
          style={[StyleSheet.absoluteFill, { borderRadius: 30, backgroundColor: C.white }]}
        />
        {/* ▶ 광학 보정은 PlayIcon 안에 들어 있다 */}
        <PlayIcon size={20} color={C.onWhite} />
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
   * 알약 모양 + 왼쪽 끝의 원형 ＋ + 아래로 깔리는 그림자.
   * ＋는 절대 배치라 라벨은 글자 수와 무관하게 버튼 정중앙에 온다.
   */
  const inner = (color: string, size: number, weight: '600' | '700') => (
    <>
      <View style={styles.center}>
        <Text style={{ fontSize: size, fontWeight: weight, color }}>{label}</Text>
      </View>
      <View style={styles.addPlusSlot} pointerEvents="none">
        {/* 전각 ＋는 em 박스 안에서 작게 그려진다 — 크게 보이려면 훨씬 키워야 한다 */}
        <Text style={{ fontSize: 44, fontWeight: '300', lineHeight: 52, color }}>＋</Text>
      </View>
    </>
  );

  if (primary) {
    return (
      <PressBox
        onPress={go}
        radius={ADD_RADIUS}
        scaleTo={0.975}
        dim={0.14}
        style={[styles.addPill, LIFT]}
        accessibilityLabel={label}
      >
        <View
          style={[StyleSheet.absoluteFill, { borderRadius: ADD_RADIUS, backgroundColor: C.white }]}
        />
        {inner(C.onWhite, 18, '700')}
      </PressBox>
    );
  }

  return (
    <PressBox
      onPress={go}
      radius={ADD_RADIUS}
      scaleTo={0.975}
      dim={0.22}
      accessibilityLabel={label}
    >
      <Surface radius={ADD_RADIUS} style={styles.addPill} elevation={LIFT}>
        {inner(C.textPrimary, 17, '600')}
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
  sortRow: {
    marginTop: 14,
    marginBottom: -4,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  sortText: { fontSize: 13, fontWeight: '600', color: C.textTertiary },
  sortChevron: { fontSize: 13, color: C.textTertiary },
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
    width: 60,
    height: 60,
    borderRadius: 30,
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** 버튼 왼쪽 끝의 ＋ 자리 */
  addPlusSlot: {
    position: 'absolute',
    left: 22,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
