/** 5.6 실행 화면 — 이 앱의 심장 */
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FloodTile } from '../src/components/Surface';
import { PressBox } from '../src/components/PressBox';
import { NextIcon, PauseIcon, PencilIcon, PlayIcon, PrevIcon } from '../src/components/Icons';
import { PhaseFlood } from '../src/components/PhaseFlood';
import { Ring } from '../src/components/Ring';
import { clock, describeSegment, isSimple, jumpLabel, subLabel, titleLabel } from '../src/engine/labels';
import { ensurePermission } from '../src/notify';
import { useSession } from '../src/session';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { C, GUTTER, PHASE_COLOR, TABULAR } from '../src/theme';

export default function Run() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useStore();
  const run = useSession();
  const preset = run.preset;
  useEffect(() => {
    void ensurePermission();
  }, []);

  useEffect(() => {
    if (!settings.keepScreenOn) return;
    void activateKeepAwakeAsync('intava-run');
    return () => {
      void deactivateKeepAwake('intava-run');
    };
  }, [settings.keepScreenOn]);

  // 전체가 끝나면 완료 화면으로 — 세션은 완료 화면에서 정리한다
  useEffect(() => {
    if (!run.done || !preset) return;
    router.replace({ pathname: '/done', params: { id: preset.id } });
  }, [run.done, preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!preset) {
    // 여기 걸리면 데이터가 어긋난 것이다. 빈 화면에 가두지 않는다.
    return <MissingPreset />;
  }

  const phase = run.seg?.phase ?? 'DONE';
  const color = PHASE_COLOR[phase];
  const simple = isSimple(preset);
  // 웜업·준비·라운드 휴식·쿨다운에서는 종목 이름이 전부 흐리다.
  // 종목 전환 중에는 도착할 종목을 밝힌다 — 아래 줄의 "3번째 종목"과 같은 것을 가리킨다.
  const currentBlk = !run.seg
    ? -1
    : run.seg.phase === 'WORK' || run.seg.phase === 'SET_REST'
      ? (run.seg.blk ?? -1)
      : run.seg.phase === 'BLOCK_REST'
        ? (run.seg.blk ?? -1) + 1
        : -1;

  const confirmExit = () => {
    Alert.alert(t('run.exitTitle'), t('run.exitBody'), [
      { text: t('run.exitContinue'), style: 'cancel' },
      {
        text: t('run.exitConfirm'),
        style: 'destructive',
        onPress: () => {
          run.stop();
          router.replace('/');
        },
      },
    ]);
  };

  const prevLabel =
    run.seg && run.elapsed - run.seg.start > 1.2 ? t('run.prevRestart') : t('run.prevBack');
  const barPct = run.total > 0 ? Math.min(100, (run.elapsed / run.total) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: color }}>
      <PhaseFlood color={color} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 12) }}>
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
            onPress={() => router.push({ pathname: '/edit', params: { id: preset.id } })}
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

        {/* 종목 이름 줄 — 버튼이 아니라 표시. 배경·테두리를 주지 않는다 */}
        {!simple && (
          <View style={styles.blockRow}>
            {preset.blocks.map((b, i) => (
              <Text
                key={b.id}
                style={[styles.blockName, i === currentBlk ? styles.blockNow : styles.blockOther]}
              >
                {b.name}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.ringWrap}>
          <Ring
            ratio={run.ratio}
            remainSec={run.remain}
            durSec={run.seg?.dur ?? 0}
            title={titleLabel(run.seg, run.paused, preset)}
            clock={clock(run.remain)}
            sub={subLabel(run.seg, preset)}
            warn={!run.done && run.remain <= 3 && !run.paused}
            paused={run.paused}
            syncKey={`${run.idx}:${run.syncId}`}
            onScrub={run.done ? undefined : run.scrubRemain}
            onScrubEnd={run.commitScrub}
          />
        </View>

        <View style={{ paddingHorizontal: GUTTER, gap: 20 }}>
          <Text style={styles.nextText} numberOfLines={1}>
            {t('run.next', { what: describeSegment(run.next) })}
          </Text>

          <View style={styles.controls}>
            <ControlButton label={prevLabel} onPress={run.skipPrev}>
              <PrevIcon />
            </ControlButton>

            <PressBox
              onPress={run.toggle}
              radius={48}
              scaleTo={0.93}
              dim={0.12}
              style={styles.mainButton}
              accessibilityLabel={run.paused ? t('run.resume') : t('run.pause')}
            >
              {run.paused ? <PlayIcon color={color} /> : <PauseIcon color={color} />}
            </PressBox>

            <ControlButton label={jumpLabel(run.next)} onPress={run.skipNext}>
              <NextIcon />
            </ControlButton>
          </View>

          {/* 전체 진행 바 — 노치를 피해 하단에 둔다 */}
          <View>
            <View style={styles.track}>
              <LinearGradient
                colors={['rgba(255,255,255,0.75)', '#FFFFFF']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ height: 6, width: `${barPct}%`, borderRadius: 3 }}
              />
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
    </View>
  );
}

/** 실행할 프리셋이 없을 때 — 홈으로 돌려보낸다 */
function MissingPreset() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
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
      hitSlop={8}
      scaleTo={0.88}
      dim={0}
      style={styles.control}
      accessibilityLabel={label}
    >
      <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      {/* 언어에 따라 라벨 길이가 크게 달라진다. 줄바꿈 대신 살짝 줄여 한 줄을 지킨다 */}
      <Text style={styles.controlLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Text>
    </PressBox>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  tile: { width: 48, height: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileGlyph: { fontSize: 20, color: '#FFFFFF', opacity: 0.9 },
  routineName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', opacity: 0.85, flex: 1, textAlign: 'center' },
  blockRow: {
    paddingTop: 18,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
  },
  blockName: { fontSize: 15, color: '#FFFFFF' },
  blockNow: { fontWeight: '700', opacity: 1 },
  blockOther: { fontWeight: '600', opacity: 0.5 },
  ringWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  nextText: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: '#FFFFFF', opacity: 0.85 },
  controls: { flexDirection: 'row', gap: 26, alignItems: 'center', justifyContent: 'center' },
  control: { width: 96, alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF', opacity: 0.8 },
  mainButton: {
    width: 96,
    height: 96,
    marginBottom: 19,
    borderRadius: 48,
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
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.20)',
    overflow: 'hidden',
  },
  barLabels: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', opacity: 0.75 },
});
