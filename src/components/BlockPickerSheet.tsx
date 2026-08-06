/**
 * 종목 추가 방법을 고르는 시트.
 *
 * 이미 만들어 둔 타이머는 그 자체가 완결된 종목(운동·휴식·세트)이다.
 * 루틴에 종목을 넣을 때 그 값을 그대로 가져오면 같은 숫자를 두 번 입력하지 않아도 된다.
 * 가져온 뒤에는 원본과 무관한 복사본이라, 한쪽을 고쳐도 다른 쪽은 그대로다.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blockSummary } from '../engine/labels';
import { t } from '../i18n';
import { ABS, C, E3, GUTTER, RADIUS, TABULAR } from '../theme';
import type { Block, Preset } from '../types';
import { PressBox } from './PressBox';

type Props = {
  visible: boolean;
  /** 가져올 수 있는 타이머들 */
  timers: Preset[];
  onClose: () => void;
  /** 타이머에서 가져오기 — 값은 복사본으로 넘어간다 */
  onPickTimer: (block: Block) => void;
  /** 빈 종목부터 만들기 */
  onCreateNew: () => void;
};

export function BlockPickerSheet({ visible, timers, onClose, onPickTimer, onCreateNew }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <View style={[styles.sheet, E3]}>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[C.sheetTop, C.sheetBottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.sheetBorder} pointerEvents="none" />

          <View style={styles.grabWrap}>
            <View style={styles.grab} />
          </View>

          <Text style={styles.title}>{t('pickBlock.title')}</Text>

          <View style={{ paddingHorizontal: GUTTER }}>
            <PressBox
              onPress={onCreateNew}
              radius={RADIUS.tile}
              scaleTo={0.97}
              dim={0.22}
              style={styles.newTile}
              accessibilityLabel={t('pickBlock.newBlock')}
            >
              <View style={styles.center}>
                <Text style={styles.newLabel}>{t('pickBlock.newBlock')}</Text>
              </View>
            </PressBox>
          </View>

          <Text style={styles.section}>{t('pickBlock.fromTimer')}</Text>

          {timers.length === 0 ? (
            <Text style={styles.empty}>{t('pickBlock.empty')}</Text>
          ) : (
            <ScrollView
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingHorizontal: GUTTER - 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {timers.map((timer) => {
                const src = timer.blocks[0];
                if (!src) return null;
                return (
                  <PressBox
                    key={timer.id}
                    onPress={() => onPickTimer({ ...src, name: timer.name })}
                    radius={14}
                    scaleTo={0.98}
                    dim={0.22}
                    style={styles.timerRow}
                    accessibilityLabel={timer.name}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timerName} numberOfLines={1}>
                        {timer.name}
                      </Text>
                      <Text style={[styles.timerSummary, TABULAR]} numberOfLines={1}>
                        {blockSummary(src.workSec, src.restSec, src.sets)}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </PressBox>
                );
              })}
            </ScrollView>
          )}

          <View style={{ height: Math.max(insets.bottom, 16) }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...ABS, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: 'hidden',
  },
  sheetBorder: {
    ...ABS,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  grabWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  title: {
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    paddingBottom: 16,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  newTile: { height: 52, backgroundColor: C.surface },
  newLabel: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    marginTop: 26,
    marginBottom: 6,
    paddingHorizontal: GUTTER,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.78,
    color: C.textTertiary,
  },
  empty: {
    paddingHorizontal: GUTTER,
    paddingVertical: 18,
    fontSize: 15,
    color: C.textSecondary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  timerName: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  timerSummary: { marginTop: 4, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  chevron: { fontSize: 20, color: C.textTertiary, marginLeft: 10 },
});
