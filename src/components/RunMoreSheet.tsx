/**
 * 실행 중 「더보기」 — 지금 하는 운동에 손대는 두 가지.
 *
 * 하단 진행 바 위에는 「순서 바꾸기」 하나만 걸려 있었다. 거기에 「종목 넘기기」를
 * 나란히 붙이면 작은 글자 두 개가 다투므로, 한 겹을 두고 그 안에서 고르게 한다.
 *
 * 컨트롤 줄(⏮ ⏸ ⏭)에 네 번째 버튼을 더하지 않은 이유도 같다 — 운동 중에 눈으로
 * 좇는 자리는 링과 그 아래 큰 버튼이고, 거기에 무엇을 더하면 셋의 균형이 깨진다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressBox } from './PressBox';
import { Sheet } from './Sheet';
import { t } from '../i18n';
import { C, GUTTER, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 순서 시트를 연다 — 이 시트는 닫고 그 시트를 띄운다 */
  onReorder: () => void;
  onSkipBlock: () => void;
  /** 넘길 종목이 없는 자리(웜업·준비·쿨다운, 이미 휴식 중)에서는 흐리게 둔다 */
  canSkipBlock: boolean;
};

export function RunMoreSheet({ visible, onClose, onReorder, onSkipBlock, canSkipBlock }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Text style={styles.title}>{t('run.moreTitle')}</Text>

        <Row
          label={t('run.reorder')}
          note={t('run.reorderNote')}
          onPress={() => {
            onClose();
            onReorder();
          }}
        />
        <Row
          label={t('run.skipBlock')}
          note={t('run.skipBlockNote')}
          disabled={!canSkipBlock}
          onPress={() => {
            onClose();
            onSkipBlock();
          }}
        />
      </View>
    </Sheet>
  );
}

function Row({
  label,
  note,
  onPress,
  disabled,
}: {
  label: string;
  note: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressBox
      onPress={onPress}
      disabled={disabled}
      radius={RADIUS.tile}
      scaleTo={0.98}
      dim={0.2}
      style={[styles.row, disabled && styles.rowOff]}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressBox>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: 6, gap: 10 },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.34,
    color: C.textPrimary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: RADIUS.tile,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  /** 흐리게 — 누를 수 없다는 것을 색으로만 말한다. 자리는 그대로 둔다 */
  rowOff: { opacity: 0.38 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  rowNote: { marginTop: 4, fontSize: 13, lineHeight: 18, color: C.textTertiary },
  chevron: { fontSize: 20, color: C.textTertiary },
});
