/** 5.7 완료 — DONE 색 플러드 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WhiteButton } from '../src/components/Buttons';
import { PressBox } from '../src/components/PressBox';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { clock, isSimple } from '../src/engine/labels';
import { NO_LIVED, type Lived, type RoundOrders } from '../src/engine/segments';
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
  const { id, lived, full, orders } = useLocalSearchParams<{
    id: string;
    lived?: string;
    full?: string;
    orders?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPreset, savePreset } = useStore();
  const toast = useToast();
  const session = useSession();
  const preset = getPreset(id);

  // 완료 화면에 닿았으면 그 세션은 끝난 것이다 — 미니 바가 남지 않게 정리한다
  useEffect(() => {
    session.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 실행 중에 바꾼 차례 — 라운드별. 마지막 라운드의 것이 최종 차례다 */
  const rounds = useMemo<RoundOrders | undefined>(() => {
    if (!orders) return undefined;
    try {
      const parsed = JSON.parse(orders);
      return Array.isArray(parsed) && parsed.length ? (parsed as RoundOrders) : undefined;
    } catch {
      return undefined;
    }
  }, [orders]);

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
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* 끝까지 갔는지 도중에 껐는지 — 숫자만 다르고 말은 그대로면 거짓말이 된다 */}
          <Text style={styles.title}>
            {t(full ? 'doneScreen.title' : 'doneScreen.titleStopped')}
          </Text>
          {/* 이름이 먼저, 구성은 그 아래 한 단계 작게 — 한 줄로 이으면 두 줄로 접힌다 */}
          <Text style={styles.name} numberOfLines={2}>
            {preset.name}
          </Text>
          {!!detailLine(preset) && <Text style={styles.detail}>{detailLine(preset)}</Text>}

          <View style={{ marginTop: 34 }}>
            <StatRow label={t('doneScreen.totalTime')} value={clock(stats.total)} first />
            <StatRow label={t('doneScreen.pureWork')} value={clock(stats.work)} />
            <StatRow
              label={isSimple(preset) ? t('doneScreen.completedSets') : t('doneScreen.completedRounds')}
              value={isSimple(preset) ? `${stats.sets}` : `${stats.rounds}`}
            />
          </View>
        </View>

        {/*
          자리는 그대로 두고 무게만 바꿨다. 운동을 마친 사람이 여기서 열에 아홉은
          홈으로 간다 — 흰 버튼은 그쪽이 맞다. 다시 하기는 방금 돌던 차례 그대로
          시작하며(여기서 또 저장을 묻지 않는다) 글자만 남긴다.
        */}
        <PressBox
          onPress={() => {
            session.start(preset.id, rounds);
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
});
