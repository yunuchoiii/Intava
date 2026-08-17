/** 5.7 완료 — DONE 색 플러드 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WhiteButton } from '../src/components/Buttons';
import { Chevron, Collapsible } from '../src/components/Collapsible';
import { PressBox } from '../src/components/PressBox';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { clock, isSimple } from '../src/engine/labels';
import { clockTime } from '../src/engine/records';
import { NO_LIVED, type Lived, type RoundOrders, type RoundSkips } from '../src/engine/segments';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { useToast } from '../src/components/Toast';
import { t } from '../src/i18n';
import { GUTTER, PHASE_COLOR, TABULAR } from '../src/theme';
import type { Preset } from '../src/types';

export default function Done() {
  /**
   * 끝까지 간 경우와 도중에 끈 경우가 같은 화면을 쓴다.
   *
   * 넘어오는 값 — 무엇을(id), 실제로 지나온 몫(lived), 끝까지 갔는지(full),
   * 어떤 차례로 돌았는지(orders). **세션에서 읽지 않는다.** 이 화면은 뜨자마자
   * 세션을 비우기 때문에(미니 바가 남으면 안 된다) 그 뒤에는 물어볼 데가 없다.
   */
  const { id, lived, record, full, orders, skips } = useLocalSearchParams<{
    id: string;
    lived?: string;
    /** 방금 남긴 기록의 id — 종목별 몫과 구간 이력은 거기서 꺼낸다 */
    record?: string;
    full?: string;
    orders?: string;
    skips?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPreset, savePreset, records } = useStore();
  const toast = useToast();
  const session = useSession();
  const preset = getPreset(id);
  /** 종목별 표는 접어 둔 채로 시작한다 — 먼저 보는 것은 아래 숫자 넷이다 */
  const [blocksOpen, setBlocksOpen] = useState(false);

  // 완료 화면에 닿았으면 그 세션은 끝난 것이다 — 미니 바가 남지 않게 정리한다
  useEffect(() => {
    session.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 실행 중에 바꾼 차례 — 라운드별. 마지막 라운드의 것이 최종 차례다 */
  const rounds = useMemo<RoundOrders | undefined>(() => parseRounds(orders), [orders]);
  /**
   * 실행 중에 뺀 종목 — 라운드별.
   *
   * "다시 하기"에만 쓴다. 루틴에 남길지는 **묻지 않는다** — 빼기는 "오늘 어깨가
   * 아파서 건너뛴다" 같은 일회성 판단이라, 루틴에서 영영 지우는 것은 편집 화면의
   * 삭제가 할 일이다. 순서와 한꺼번에 물으면 되돌릴 수 없는 쪽이 묻어 들어간다.
   */
  const dropped = useMemo<RoundSkips | undefined>(() => parseRounds(skips), [skips]);

  /**
   * 계획이 아니라 실제로 지나온 만큼 — 세션이 정산해 넘겨준 값이다.
   * 넘기기(⏭)로 건너뛴 구간은 여기에 들어 있지 않다.
   */
  const stats = useMemo<Lived>(() => {
    if (!lived) return NO_LIVED;
    try {
      return { ...NO_LIVED, ...(JSON.parse(lived) as Lived) };
    } catch {
      return NO_LIVED;
    }
  }, [lived]);

  /**
   * 방금 남긴 기록 — 종목별 몫과 구간 이력이 여기 들어 있다.
   *
   * 세션이 정산하면서 이미 계산해 저장소에 넣어 둔 것이라 다시 셀 필요가 없다.
   * 세션은 이 화면이 뜨자마자 비워지지만 **기록은 저장소에 남으므로** 안전하다.
   */
  const entry = useMemo(
    () => (record ? records.find((r) => r.id === record) : undefined),
    [record, records]
  );

  /** 마지막에 돌던 차례가 저장된 루틴과 다른가 */
  const changed = useMemo(() => {
    if (!preset || !rounds) return null;
    const last = rounds[rounds.length - 1];
    if (!last) return null;
    const natural = preset.blocks.map((b) => b.id);
    if (last.length !== natural.length || last.every((x, i) => x === natural[i])) return null;
    return last;
  }, [preset, rounds]);

  if (!preset) {
    return <View style={{ flex: 1, backgroundColor: PHASE_COLOR.DONE }} />;
  }

  /**
   * 홈으로 — 바뀐 차례를 루틴에 남길지는 여기서 한 번만 묻는다.
   * 시트에서 바꾸는 그 순간에는 좋은 차례인지 아직 모른다. 해보고 나서야 안다.
   */
  const goHome = () => {
    if (!changed) {
      router.dismissTo('/');
      return;
    }
    Alert.alert(t('doneScreen.saveOrderTitle'), t('doneScreen.saveOrderBody'), [
      { text: t('doneScreen.saveOrderSkip'), onPress: () => router.dismissTo('/') },
      {
        text: t('doneScreen.saveOrderConfirm'),
        onPress: () => {
          const byId = new Map(preset.blocks.map((b) => [b.id, b]));
          const next = changed.map((bid) => byId.get(bid)).filter((b) => !!b);
          savePreset({ ...preset, blocks: next });
          toast(t('toast.orderSaved'));
          router.dismissTo('/');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PHASE_COLOR.DONE }}>
      <PhaseFlood color={PHASE_COLOR.DONE} />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 58,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: GUTTER,
        }}
      >
        {/*
          가운데는 스크롤한다. 종목이 많은 루틴에서는 표가 길어져 아래 버튼을
          밀어내는데, 운동을 막 끝낸 사람이 홈으로 갈 길을 잃으면 안 된다.
          짧을 때는 가운데 정렬 그대로다(contentContainer의 flexGrow + center).
        */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* 끝까지 갔는지 도중에 껐는지 — 숫자만 다르고 말은 그대로면 거짓말이 된다 */}
          <Text style={styles.title}>
            {t(full ? 'doneScreen.title' : 'doneScreen.titleStopped')}
          </Text>
          {/* 이름이 먼저, 구성은 그 아래 한 단계 작게 — 한 줄로 이으면 두 줄로 접힌다 */}
          <Text style={styles.name} numberOfLines={2}>
            {preset.name}
          </Text>
          {!!detailLine(preset) && <Text style={styles.detail}>{detailLine(preset)}</Text>}
          {/* 언제부터 언제까지 — 기록 화면이 카드 머리에 적는 것과 같은 사실이다 */}
          {!!entry && (
            <Text style={[styles.detail, TABULAR]}>
              {t('doneScreen.span', {
                from: clockTime(entry.startedAt),
                to: clockTime(entry.endedAt),
              })}
            </Text>
          )}

          {/*
            구간 스트립 — 긴 막대가 운동, 짧은 막대가 휴식. 페이즈를 그대로
            칠하지 않고 **운동이냐 아니냐**로만 가른다. 기록 화면과 같은 문법이되
            색은 다시 잡았다. 저기는 어두운 유리 위라 분홍·민트였지만 여기는
            초록 위 흰 글자의 화면이라, 흰색의 농도로만 말하는 것이 맞다.
          */}
          {!!entry?.segs.length && (
            <View style={styles.strip}>
              {entry.segs.slice(0, 40).map((s, i) => (
                <View
                  key={i}
                  style={{
                    flex: Math.max(0.4, s.durSec),
                    borderRadius: 4,
                    backgroundColor:
                      s.phase === 'WORK' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.34)',
                  }}
                />
              ))}
            </View>
          )}

          {/*
            종목별로 실제 보낸 시간 — 넘긴 종목은 여기 없다.

            막대 바로 아래 둔다. 막대가 "어떤 결로 흘렀나"를 그림으로 말하면,
            이 목록이 그 그림의 이름표다 — 둘이 떨어져 있으면 서로를 못 가리킨다.

            접어 둔 채로 시작한다. 운동을 막 끝낸 사람이 먼저 보는 것은 아래 숫자
            넷이고, 종목별 몫은 궁금할 때 펴 보는 것이다.
          */}
          {!!entry?.blocks.length && (
            <View style={styles.blocks}>
              <PressBox
                onPress={() => setBlocksOpen((v) => !v)}
                radius={10}
                scaleTo={0.99}
                dim={0}
                style={styles.blocksHead}
                accessibilityLabel={t('count.exercises', { count: entry.blocks.length })}
              >
                <Text style={styles.blocksTitle}>
                  {t('count.exercises', { count: entry.blocks.length })}
                </Text>
                <Chevron open={blocksOpen} color="#FFFFFF" />
              </PressBox>
              <Collapsible open={blocksOpen}>
                {/* 마지막 줄이 테두리에 닿지 않게 — 안쪽 여백은 여기서 준다 */}
                <View style={{ paddingBottom: 8 }}>
                  {entry.blocks.map((b, i) => (
                    <View key={`${b.name}${i}`} style={styles.blockRow}>
                      <Text style={styles.blockName} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={[styles.blockSpec, TABULAR]} numberOfLines={1}>
                        {b.spec}
                      </Text>
                      <Text style={[styles.blockDur, TABULAR]}>{clock(b.durSec)}</Text>
                    </View>
                  ))}
                </View>
              </Collapsible>
            </View>
          )}

          <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
            <StatRow label={t('doneScreen.totalTime')} value={clock(stats.total)} first />
            <StatRow label={t('doneScreen.pureWork')} value={clock(stats.work)} />
            {/*
              예전에는 세트와 라운드 중 하나만 보였다. 둘 다 Lived에 있는데
              굳이 고를 이유가 없다 — 라운드를 도는 루틴에서 "몇 세트 했나"는
              그 자체로 알고 싶은 숫자다.
            */}
            <StatRow label={t('doneScreen.completedSets')} value={`${stats.sets}`} />
            {!isSimple(preset) && (
              <StatRow label={t('doneScreen.completedRounds')} value={`${stats.rounds}`} />
            )}
          </View>
        </ScrollView>

        {/*
          자리는 그대로 두고 무게만 바꿨다. 운동을 마친 사람이 여기서 열에 아홉은
          홈으로 간다 — 흰 버튼은 그쪽이 맞다. 다시 하기는 방금 돌던 차례 그대로
          시작하며(여기서 또 저장을 묻지 않는다) 글자만 남긴다.
        */}
        <PressBox
          onPress={() => {
            session.start(preset.id, rounds, dropped);
            router.replace('/run');
          }}
          haptic="commit"
          scaleTo={0.96}
          dim={0}
          style={styles.textButton}
          accessibilityLabel={t('doneScreen.again')}
        >
          <Text style={styles.textButtonLabel}>{t('doneScreen.again')}</Text>
        </PressBox>
        {/* 홈까지 물러난다 — replace면 홈 위에 홈이 한 겹 더 쌓인다 */}
        <WhiteButton
          label={t('doneScreen.home')}
          height={72}
          color={PHASE_COLOR.DONE}
          haptic="none"
          onPress={goHome}
        />
      </View>
    </View>
  );
}

/** 라운드별 id 배열 — 차례와 뺀 것이 같은 꼴이라 읽는 법도 하나다 */
function parseRounds(raw?: string): string[][] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as string[][]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 이름 아래 한 줄 — 무엇을 한 것인지의 **생김새**만.
 *
 * 세트 수는 넣지 않는다. 바로 아래 표에 실제로 해낸 세트가 있는데 여기에도
 * 숫자가 있으면 둘이 다투고("0세트"인데 "3종목 2라운드"), 줄도 길어져 접힌다.
 * 타이머(종목 하나)는 적을 구성이 없어 웜업·쿨다운만 남는다.
 */
function detailLine(p: Preset): string {
  const parts = [
    isSimple(p)
      ? null
      : t('doneScreen.composition', {
          blocks: t('count.blocks', { count: p.blocks.length }),
          rounds: t('count.rounds', { count: p.rounds }),
        }),
    p.warmupSec > 0 || p.cooldownSec > 0
      ? t('doneScreen.extraPart', {
          extra: [
            p.warmupSec > 0 ? t('doneScreen.warmup') : null,
            p.cooldownSec > 0 ? t('doneScreen.cooldown') : null,
          ]
            .filter(Boolean)
            .join('/'),
        })
      : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function StatRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.stat, first && { borderTopWidth: 0 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, TABULAR]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * 짧으면 가운데, 길면 스크롤 — flexGrow가 그 둘을 한 규칙으로 만든다.
   *
   * 아래 여백은 넉넉해야 한다. 종목 표가 길어지면 마지막 줄이 「다시 하기」에
   * 그대로 붙어, 표의 일부인지 버튼인지 구분이 안 된다.
   */
  scroll: { flexGrow: 1, justifyContent: 'center', paddingTop: 8, paddingBottom: 40 },
  title: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.76,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  name: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    opacity: 0.95,
    textAlign: 'center',
  },
  detail: {
    marginTop: 7,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.62,
    textAlign: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
  },
  statLabel: { fontSize: 18, color: '#FFFFFF', opacity: 0.85 },
  statValue: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  /** 바탕 없는 글자 버튼 — 흰 버튼 옆에서 한 걸음 물러선다 */
  textButton: { height: 60, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },

  /** 구간 스트립 — 실행 화면 하단 눈금과 같은 두께로 */
  strip: { marginTop: 26, flexDirection: 'row', gap: 3, height: 8, alignSelf: 'stretch' },

  /**
   * 종목별 표 — 어두운 판을 깔지 않는다. 이 화면은 초록 위 흰 글자가 규칙이라
   * 판을 깔면 그 자리만 다른 화면처럼 뜬다. 줄 사이의 얇은 선으로만 나눈다.
   */
  /**
   * 접히는 상자 — 반투명한 흰 테두리로 둘레를 긋는다.
   *
   * 이 화면은 판을 깔지 않는 것이 규칙이라(초록 위 흰 글자) 배경 대신 선으로만
   * 묶는다. `overflow: hidden`은 펼쳐지는 내용이 둥근 모서리 밖으로 새지 않게 한다.
   */
  blocks: {
    marginTop: 18,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  /** 접었다 펴는 손잡이 — 상자 폭에 걸쳐 눌리는 자리를 넓게 준다 */
  blocksHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  blocksTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', opacity: 0.85 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.20)',
  },
  blockName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  blockSpec: { marginRight: 12, fontSize: 12.5, color: '#FFFFFF', opacity: 0.62 },
  blockDur: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', opacity: 0.9 },
});
