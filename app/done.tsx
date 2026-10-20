/**
 * 운동 완료 — 화면이 곧 공유 카드다(시안 「스토리 공유 카드」 2a·2c).
 *
 * 두 길로 열린다.
 * - 운동이 끝나서(run → done): 세션을 정리하고, 운동 중에 바꾼 것을 루틴에 남길지
 *   「홈으로」에서 묻고, 끝까지 간 운동이면 리뷰를 청할 차례를 센다.
 * - 기록 화면에서 다시 볼 때(view=1): 그날의 카드를 보여 주고 공유만 한다. 돌고 있는
 *   세션은 건드리지 않는다 — 운동 중에 지난 기록을 열어 볼 수도 있다.
 *
 * 그리는 것은 모두 **기록**에서 온다. 세션은 이 화면이 뜨자마자 비워지지만 기록은
 * 저장소에 남는다. 공유 이미지(1080×1920)는 같은 기록으로 따로 그려 찍는다.
 */
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PixelRatio, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { WhiteButton } from '../src/components/Buttons';
import { PressBox } from '../src/components/PressBox';
import {
  Backdrop,
  BlockLine,
  CARD,
  Legend,
  Logo,
  SegStrip,
  ShareImage,
  SplitRing,
  cardDateLine,
  cardStyles,
  subtitleLine,
} from '../src/components/WorkoutCard';
import { clock } from '../src/engine/labels';
import { type RoundOrders } from '../src/engine/segments';
import { noteFinishedWorkout } from '../src/review';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { useToast } from '../src/components/Toast';
import { t } from '../src/i18n';
import { TABULAR } from '../src/theme';
import { presetFingerprint, type Preset } from '../src/types';

/**
 * 1080×1920(인스타 스토리) — view-shot의 width·height는 기기 배율이 한 번 더 곱해져
 * 그대로 주면 3배(3240×5760)로 찍혔다. 배율로 나눠 준다.
 */
const SHOT = {
  format: 'png' as const,
  width: 1080 / PixelRatio.get(),
  height: 1920 / PixelRatio.get(),
  result: 'tmpfile' as const,
};

export default function Done() {
  const { id, record, full, orders, edited, view } = useLocalSearchParams<{
    id?: string;
    /** 방금 남긴(또는 다시 볼) 기록의 id — 화면의 모든 숫자가 여기서 온다 */
    record?: string;
    full?: string;
    orders?: string;
    /** 운동 중에 고친 루틴 사본(JSON) — 고친 것이 없으면 비어 있다 */
    edited?: string;
    /** 기록 화면에서 다시 보는 중 — 세션·저장 묻기·리뷰를 건드리지 않는다 */
    view?: string;
  }>();
  const viewing = view === '1';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPreset, savePreset, records } = useStore();
  const toast = useToast();
  const session = useSession();
  const shot = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  /** 종목 목록이 판보다 길어 스크롤되는가 — 그때만 아래에 흐려짐을 깐다(시안 2c) */
  const [overflow, setOverflow] = useState(false);
  const listBox = useRef(0);
  const listContent = useRef(0);
  const measureOverflow = () => setOverflow(listContent.current > listBox.current + 1);

  // 완료 화면에 닿았으면 그 세션은 끝난 것이다 — 미니 바가 남지 않게 정리한다
  useEffect(() => {
    if (!viewing) session.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 리뷰를 청할 자리 — **끝까지 간 실행에서만.** 도중에 껐다면 그 사람은 지금 만족한
   * 상태가 아니다. 나머지 조건은 review.ts에 있다. 화면을 먼저 떠나면 묻는 것만 취소된다.
   */
  useEffect(() => {
    if (!full || viewing) return;
    return noteFinishedWorkout();
  }, [full, viewing]);

  const entry = useMemo(
    () => (record ? records.find((r) => r.id === record) : undefined),
    [record, records]
  );

  const saved = id ? getPreset(id) : undefined;
  /** 운동 중에 고친 사본 — 루틴과 다르게 돌았을 수 있다 */
  const tweaked = useMemo<Preset | undefined>(() => {
    if (!edited) return undefined;
    try {
      const p = JSON.parse(edited) as Preset;
      return p?.id === id && Array.isArray(p.blocks) ? p : undefined;
    } catch {
      return undefined;
    }
  }, [edited, id]);
  const preset = tweaked ?? saved;
  /** 실행 중에 바꾼 차례 — 라운드별. 마지막 라운드의 것이 최종 차례다 */
  const rounds = useMemo<RoundOrders | undefined>(() => parseRounds(orders), [orders]);

  /**
   * 루틴에 남길 모양 — 운동 중에 고친 종목과 마지막에 돌던 차례를 합친 것.
   * 저장된 루틴과 같으면 null이다(물을 것이 없다). 뺀 종목은 여기 들어가지 않는다 —
   * 빼기는 「오늘은 건너뛴다」 같은 일회성 판단이라 루틴에서 지우는 것은 편집 화면의 일이다.
   */
  const proposal = useMemo<Preset | null>(() => {
    if (viewing || !saved || !preset) return null;
    let blocks = preset.blocks;
    const last = rounds?.[rounds.length - 1];
    if (last) {
      const byId = new Map(blocks.map((b) => [b.id, b]));
      const picked = last.map((bid) => byId.get(bid)).filter((b) => !!b);
      blocks = [...picked, ...blocks.filter((b) => !picked.includes(b))];
    }
    // 날짜 도장은 저장소 것을 그대로 둔다 — 사본은 시작할 때 베낀 것이라 그 뒤 값이 옛것이다
    const next: Preset = {
      ...saved,
      ...preset,
      blocks,
      createdAt: saved.createdAt,
      lastRunAt: saved.lastRunAt,
    };
    return presetFingerprint(next) === presetFingerprint(saved) ? null : next;
  }, [viewing, saved, preset, rounds]);

  /**
   * 홈으로 — 운동 중에 바꾼 것(종목·차례)을 루틴에 남길지는 여기서 한 번만 묻는다.
   * 시트에서 바꾸는 그 순간에는 좋은 값인지 아직 모른다. 해보고 나서야 안다.
   */
  const leave = () => {
    if (viewing) {
      router.back();
      return;
    }
    if (!proposal) {
      router.dismissTo('/');
      return;
    }
    Alert.alert(t('doneScreen.saveChangesTitle'), t('doneScreen.saveChangesBody'), [
      { text: t('doneScreen.saveChangesSkip'), onPress: () => router.dismissTo('/') },
      {
        text: t('doneScreen.saveChangesConfirm'),
        onPress: () => {
          savePreset(proposal);
          toast(t('toast.changesSaved'));
          router.dismissTo('/');
        },
      },
    ]);
  };

  /**
   * 공유 — 숨겨 둔 360×640 카드를 1080×1920으로 찍어 iOS 공유 창에 넘긴다.
   * 그 창에 인스타그램(스토리·피드·DM)과 「이미지 저장」이 함께 있다.
   */
  const share = async () => {
    if (!shot.current || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shot, SHOT);
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      Alert.alert(t('doneScreen.shareFailTitle'), t('doneScreen.shareFailBody'));
    } finally {
      setSharing(false);
    }
  };

  const leaveLabel = t(viewing ? 'doneScreen.close' : 'doneScreen.home');
  const bottomPad = Math.max(insets.bottom - 4, 16);

  if (!entry) {
    return (
      <View style={[styles.root, { paddingBottom: bottomPad, paddingHorizontal: 24, justifyContent: 'flex-end' }]}>
        <Backdrop id="doneEmpty" />
        <WhiteButton label={leaveLabel} height={56} radius={18} haptic="none" onPress={leave} />
      </View>
    );
  }

  const maxDur = Math.max(1, ...entry.blocks.map((b) => b.durSec));
  const restSec = Math.max(0, entry.totalSec - entry.workSec);

  return (
    <View style={styles.root}>
      {/* 찍을 카드 — 바탕 뒤에 가려 둔다. 찍는 것은 가려져 있어도 된다 */}
      <ShareImage ref={shot} record={entry} />
      <Backdrop id="done" />

      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 24 }}>
        <View style={styles.head}>
          <Logo size={22} fontSize={21} />
          <Text style={[styles.date, TABULAR]} numberOfLines={1}>
            {cardDateLine(entry)}
          </Text>
        </View>

        <View style={[cardStyles.hero, { marginTop: 24, gap: 20 }]}>
          <SplitRing size={140} work={entry.workSec} total={entry.totalSec} label={clock(entry.totalSec)} labelSize={33} />
          <View style={cardStyles.heroText}>
            <Text style={[cardStyles.heroName, { fontSize: 24 }]} numberOfLines={1}>
              {entry.presetName}
            </Text>
            <Text style={[cardStyles.heroSub, { fontSize: 12.5 }]} numberOfLines={1}>
              {subtitleLine(entry)}
            </Text>
            <View style={cardStyles.legend}>
              <Legend color={CARD.work} label={t('doneScreen.legendWork')} value={clock(entry.workSec)} />
              <Legend color={CARD.rest} label={t('doneScreen.legendRest')} value={clock(restSec)} />
            </View>
          </View>
        </View>

        <SegStrip record={entry} style={{ marginTop: 22 }} />

        {entry.blocks.length > 0 ? (
          <View
            style={[cardStyles.panel, styles.list]}
            onLayout={(e) => {
              listBox.current = e.nativeEvent.layout.height;
              measureOverflow();
            }}
          >
            {/* 종목이 많으면 목록만 스크롤한다 — 머리와 버튼은 제자리(시안 2c) */}
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: overflow ? 28 : 4 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_, h) => {
                listContent.current = h;
                measureOverflow();
              }}
            >
              {entry.blocks.map((b, i) => (
                <BlockLine key={`${b.name}${i}`} block={b} record={entry} maxDur={maxDur} />
              ))}
            </ScrollView>
            {overflow && (
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(20,24,24,0)', 'rgba(20,24,24,0.9)']}
                style={styles.fade}
              />
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: bottomPad }]}>
        <PressBox
          onPress={share}
          disabled={sharing}
          haptic="tap"
          radius={18}
          scaleTo={0.97}
          dim={0.14}
          dimColor="#FFF"
          outerStyle={{ flex: 1 }}
          style={styles.shareButton}
          accessibilityLabel={t('doneScreen.share')}
        >
          <ShareIcon />
          <Text style={styles.shareLabel}>{t('doneScreen.share')}</Text>
        </PressBox>
        <WhiteButton
          label={leaveLabel}
          height={56}
          radius={18}
          color={CARD.bg}
          haptic="none"
          style={{ flex: 1.6 }}
          onPress={leave}
        />
      </View>
    </View>
  );
}

function ShareIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={CARD.text} strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v11" />
      <Path d="M7.5 7.5L12 3l4.5 4.5" />
      <Path d="M5 12v6a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18v-6" />
    </Svg>
  );
}

/** 라운드별 id 배열 */
function parseRounds(raw?: string): string[][] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as string[][]) : undefined;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CARD.bg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: CARD.sub },
  list: { flex: 1, minHeight: 0, marginTop: 18, overflow: 'hidden' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 16, paddingHorizontal: 24 },
  shareButton: {
    height: 56,
    borderRadius: 18,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shareLabel: { fontSize: 16, fontWeight: '700', color: CARD.text },
});
