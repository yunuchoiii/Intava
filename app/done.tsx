/** 5.7 완료 — DONE 색 플러드 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WhiteButton } from '../src/components/Buttons';
import { PressBox } from '../src/components/PressBox';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { clock, isSimple } from '../src/engine/labels';
import { totalSec, totalSets, workSec } from '../src/engine/segments';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { GUTTER, PHASE_COLOR, TABULAR } from '../src/theme';
import type { Preset } from '../src/types';

export default function Done() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPreset } = useStore();
  const session = useSession();
  const preset = getPreset(id);

  // 완료 화면에 닿았으면 그 세션은 끝난 것이다 — 미니 바가 남지 않게 정리한다
  useEffect(() => {
    session.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!preset) return null;
    return {
      total: totalSec(preset),
      pure: workSec(preset),
      sets: totalSets(preset),
    };
  }, [preset]);

  if (!preset || !stats) {
    return <View style={{ flex: 1, backgroundColor: PHASE_COLOR.DONE }} />;
  }

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
          <Text style={styles.title}>{t('doneScreen.title')}</Text>
          <Text style={styles.summary}>{summaryLine(preset, stats.sets)}</Text>

          <View style={{ marginTop: 34 }}>
            <StatRow label={t('doneScreen.totalTime')} value={clock(stats.total)} first />
            <StatRow label={t('doneScreen.pureWork')} value={clock(stats.pure)} />
            <StatRow
              label={isSimple(preset) ? t('doneScreen.completedSets') : t('doneScreen.completedRounds')}
              value={isSimple(preset) ? `${stats.sets}` : `${preset.rounds}`}
            />
          </View>
        </View>

        <WhiteButton
          label={t('doneScreen.again')}
          height={72}
          color={PHASE_COLOR.DONE}
          onPress={() => {
            session.start(preset.id);
            router.replace('/run');
          }}
        />
        <PressBox
          onPress={() => router.replace('/')}
          scaleTo={0.96}
          dim={0}
          style={styles.home}
          accessibilityLabel={t('doneScreen.home')}
        >
          <Text style={styles.homeLabel}>{t('doneScreen.home')}</Text>
        </PressBox>
      </View>
    </View>
  );
}

function summaryLine(p: Preset, sets: number): string {
  const setsText = t('count.sets', { count: sets });
  const summary = isSimple(p)
    ? t('doneScreen.summaryTimer', { name: p.name, sets: setsText })
    : t('doneScreen.summaryRoutine', {
        name: p.name,
        blocks: t('count.blocks', { count: p.blocks.length }),
        rounds: t('count.rounds', { count: p.rounds }),
        sets: setsText,
      });

  const extra = [
    p.warmupSec > 0 ? t('doneScreen.warmup') : null,
    p.cooldownSec > 0 ? t('doneScreen.cooldown') : null,
  ].filter(Boolean);
  return extra.length ? t('doneScreen.withExtra', { summary, extra: extra.join('/') }) : summary;
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
  summary: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.82,
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
  home: { height: 60, alignItems: 'center', justifyContent: 'center' },
  homeLabel: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
});
