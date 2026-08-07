/**
 * 실행 중 미니 바 — 실행 화면을 벗어나 있을 때 화면 하단에 붙는다.
 *
 * 타이머는 이제 화면이 아니라 세션에 산다. 그래서 목록이나 편집 화면에 있어도
 * 계속 돌고, 이 바가 그 사실을 보여주고 되돌아갈 길을 준다.
 */
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock, phaseLabel, titleLabel } from '../engine/labels';
import { useSession } from '../session';
import { LIFT, PHASE_COLOR, RADIUS, TABULAR } from '../theme';
import { PauseIcon, PlayIcon } from './Icons';
import { PressBox } from './PressBox';

export function MiniTimer() {
  const run = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // 실행 화면에서는 본체가 이미 보인다
  if (!run.preset || run.done || pathname === '/run') return null;

  const color = PHASE_COLOR[run.seg?.phase ?? 'DONE'];
  const title = run.seg
    ? titleLabel(run.seg, run.paused, run.preset)
    : phaseLabel('DONE');

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <PressBox
        onPress={() => router.push('/run')}
        radius={RADIUS.button}
        scaleTo={0.98}
        dim={0.16}
        style={[styles.bar, { backgroundColor: color }, LIFT]}
        accessibilityLabel={title}
      >
        <View style={styles.inner}>
          <Text style={[styles.clock, TABULAR]}>{clock(run.remain)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <PressBox
            onPress={run.toggle}
            radius={18}
            scaleTo={0.9}
            dim={0.18}
            style={styles.toggle}
            accessibilityLabel={title}
          >
            <View style={styles.center}>
              {run.paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
            </View>
          </PressBox>
        </View>
      </PressBox>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { height: 60, borderRadius: RADIUS.button, overflow: 'hidden' },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  clock: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: '#FFFFFF' },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF', opacity: 0.9 },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
