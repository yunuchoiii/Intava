/**
 * 실행 화면 목업 — 온보딩 1장(색이 곧 단계)의 부채꼴에 쓴다.
 *
 * 실제 실행 화면(app/run.tsx)을 393×852 기준으로 단순하게 다시 그려, 주어진 폭으로
 * 줄인다. 움직이지 않는 그림이라 세션·애니메이션과 엮지 않는다. 글자는 지금 언어를 따른다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { t } from '../i18n';
import { PHASE_COLOR, TABULAR } from '../theme';
import type { Phase } from '../types';
import { NextIcon, PauseIcon, PencilIcon, PrevIcon } from './Icons';
import { PhaseFlood } from './PhaseFlood';

const W = 393;
const H = 852;

type Mock = { title: string; clock: string; sub: string; next: string; remain: number; seg: number; elapsed: string };

function mockOf(phase: Phase): Mock {
  const squat = t('seed.squat');
  const pushup = t('seed.pushup');
  switch (phase) {
    case 'WORK':
      return { title: t('run.titleWithName', { name: squat, phase: t('phase.WORK') }), clock: '0:39',
        sub: t('sub.setsRounds', { set: 1, sets: 4, round: 1, rounds: 2 }), next: t('segment.setRest', { dur: t('duration.sec', { s: 20 }) }),
        remain: 0.7, seg: 3, elapsed: '1:12' };
    case 'SET_REST':
      return { title: t('run.titleWithName', { name: squat, phase: t('phase.SET_REST') }), clock: '0:10',
        sub: t('sub.setsRounds', { set: 1, sets: 4, round: 1, rounds: 2 }), next: t('jump.withSet', { name: t('phase.WORK'), set: 2 }),
        remain: 0.5, seg: 3, elapsed: '2:01' };
    case 'BLOCK_REST':
      return { title: t('phase.BLOCK_REST'), clock: '0:09', sub: t('sub.blockRest', { round: 1, rounds: 2, nth: 2 }),
        next: t('jump.blockWithSet', { block: pushup, set: 1 }), remain: 0.6, seg: 4, elapsed: '5:12' };
    case 'COOLDOWN':
      return { title: t('phase.COOLDOWN'), clock: '1:38', sub: t('sub.cooldown'), next: t('jump.none'),
        remain: 0.85, seg: 9, elapsed: '22:53' };
    default:
      return { title: t('phase.WARMUP'), clock: '0:34', sub: t('sub.warmup'), next: t('phase.PREPARE'),
        remain: 0.75, seg: 1, elapsed: '0:27' };
  }
}

export function MiniRun({ phase, width }: { phase: Phase; width: number }) {
  const s = width / W;
  const m = mockOf(phase);
  const color = PHASE_COLOR[phase];
  const R = 128;
  const c = 2 * Math.PI * R;
  return (
    <View style={{ width, height: H * s, borderRadius: 48 * s, overflow: 'hidden' }}>
      <View style={[styles.base, { transform: [{ translateX: (W * (s - 1)) / 2 }, { translateY: (H * (s - 1)) / 2 }, { scale: s }] }]}>
        <PhaseFlood color={color} />
        {/* 상태 줄 + 아일랜드 */}
        <View style={styles.status}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={styles.island} />
        </View>
        <View style={styles.handle} />
        <View style={styles.head}>
          <View style={styles.headBtn}><Text style={styles.x}>✕</Text></View>
          <Text style={styles.headTitle}>{t('onboarding.sampleRoutine')}</Text>
          <View style={styles.headBtn}><PencilIcon size={18} /></View>
        </View>

        <View style={styles.ringBox}>
          <View style={[StyleSheet.absoluteFill, styles.disc]} />
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width={300} height={300}>
              <Circle cx={150} cy={150} r={R} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={14} />
              <Circle cx={150} cy={150} r={R} fill="none" stroke="#FFFFFF" strokeWidth={15} strokeLinecap="round"
                strokeDasharray={`${c} ${c}`} strokeDashoffset={-c * (1 - m.remain)} />
            </Svg>
          </View>
          <View style={styles.ringText}>
            <Text style={styles.ringTitle} numberOfLines={1}>{m.title}</Text>
            <Text style={[styles.clock, TABULAR]}>{m.clock}</Text>
            <Text style={styles.ringSub} numberOfLines={1}>{m.sub}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.ctl}>
            <PrevIcon size={30} />
            <Text style={styles.ctlLabel} numberOfLines={1}>{t('run.prevRestart')}</Text>
          </View>
          <View style={styles.play}><PauseIcon size={34} color={color} /></View>
          <View style={styles.ctl}>
            <NextIcon size={30} />
            <Text style={styles.ctlLabel} numberOfLines={1}>{m.next}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.row}>
            <Text style={styles.small}>{t('run.stageOf', { i: m.seg, n: 9 })}</Text>
            <Text style={styles.small}>{t('run.more')} ›</Text>
          </View>
          <View style={styles.bar}>
            {Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={[styles.tick, i < m.seg - 1 && styles.tickDone, i === m.seg - 1 && styles.tickNow]} />
            ))}
          </View>
          <View style={styles.row}>
            <Text style={[styles.small, TABULAR]}>{t('run.elapsed', { time: m.elapsed })}</Text>
            <Text style={[styles.small, TABULAR]}>{t('run.total', { time: '24:30' })}</Text>
          </View>
        </View>
      </View>
      {/*
        테두리는 내용 **위에** 덧그린다. 상자 자체에 borderWidth를 주면 안쪽 내용이 그 두께만큼
        밀려 오른쪽 여백만 좁아졌다(실기기) — 내용은 상자 폭 그대로 줄여 그린 것이라서다.
      */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: 48 * s, borderWidth: Math.max(1, 6 * s), borderColor: '#2A2A30' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, top: 0, width: W, height: H },
  status: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, paddingTop: 8 },
  statusTime: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  island: { position: 'absolute', left: W / 2 - 63, top: 11, width: 126, height: 37, borderRadius: 19, backgroundColor: '#000' },
  handle: { alignSelf: 'center', marginTop: 6, width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  head: { marginTop: 14, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 18, color: '#FFFFFF' },
  headTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  ringBox: { marginTop: 60, alignSelf: 'center', width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  disc: { margin: 22, borderRadius: 128, backgroundColor: 'rgba(255,255,255,0.08)' },
  ringText: { position: 'absolute', left: 30, right: 30, alignItems: 'center' },
  ringTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  clock: { fontSize: 88, fontWeight: '800', letterSpacing: -4, color: '#FFFFFF' },
  ringSub: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
  controls: { marginTop: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34 },
  ctl: { width: 100, alignItems: 'center', gap: 8 },
  ctlLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  play: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 24, right: 24, bottom: 46, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  bar: { flexDirection: 'row', gap: 4, height: 6 },
  tick: { flex: 1, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  tickDone: { backgroundColor: '#FFFFFF' },
  tickNow: { backgroundColor: 'rgba(255,255,255,0.5)' },
});
