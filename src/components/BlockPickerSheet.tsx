/**
 * 종목 추가 방법을 고르는 시트.
 *
 * 이미 만들어 둔 타이머는 그 자체가 완결된 종목(운동·휴식·세트)이다.
 * 루틴에 종목을 넣을 때 그 값을 그대로 가져오면 같은 숫자를 두 번 입력하지 않아도 된다.
 * 가져온 뒤에는 원본과 무관한 복사본이라, 한쪽을 고쳐도 다른 쪽은 그대로다.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blockSummary } from '../engine/labels';
import { t } from '../i18n';
import { C, GUTTER, RADIUS, TABULAR } from '../theme';
import type { Block, Preset } from '../types';
import { PressBox } from './PressBox';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  /** 가져올 수 있는 타이머들 */
  timers: Preset[];
  onClose: () => void;
  /** 타이머에서 가져오기 — 값은 복사본으로 넘어간다 */
  onPickTimer: (block: Block) => void;
  /** 빈 종목부터 만들기 */
  onCreateNew: () => void;
  /**
   * 먼저 보여줄 종목들 — 실행 중 「운동 더 하기」에서 이 루틴의 종목을 세운다.
   *
   * 그 자리에서 제일 잦은 선택이 **방금 한 것을 한 번 더**다. 편집 화면에서
   * 종목을 더할 때는 줄 것이 없으므로 비워 둔다.
   */
  blocks?: Block[];
  /** 그 목록의 제목 — 부르는 쪽이 자리에 맞게 준다 */
  blocksTitle?: string;
};

export function BlockPickerSheet({
  visible,
  timers,
  onClose,
  onPickTimer,
  onCreateNew,
  blocks,
  blocksTitle,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const row = (key: string, name: string, b: Block, pick: () => void) => (
    <PressBox
      key={key}
      onPress={pick}
      radius={14}
      scaleTo={0.98}
      dim={0.22}
      style={styles.timerRow}
      accessibilityLabel={name}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.timerName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.timerSummary, TABULAR]} numberOfLines={1}>
          {blockSummary(b.workSec, b.restSec, b.sets)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressBox>
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
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

          {blocks && blocks.length > 0 && (
            <>
              <Text style={styles.section}>{blocksTitle}</Text>
              <View style={{ paddingHorizontal: GUTTER - 12 }}>
                {blocks.map((b) => row('b:' + b.id, b.name, b, () => onPickTimer(b)))}
              </View>
            </>
          )}

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
                return row('t:' + timer.id, timer.name, src, () =>
                  onPickTimer({ ...src, name: timer.name })
                );
              })}
            </ScrollView>
          )}

      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    paddingBottom: 16,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  // 반경을 빼먹으면 각진 상자로 보인다 — PressBox의 radius는 눌림 겹에만 쓰인다
  newTile: { height: 52, borderRadius: RADIUS.tile, backgroundColor: C.surface },
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
