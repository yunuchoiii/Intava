/**
 * 내보낼 것 고르기 — 루틴 · 운동 기록 · 설정.
 *
 * 파일 하나에 셋을 통째로 담던 것을 열었다. 기기를 바꿀 때는 셋 다지만, 기록만
 * 옮기고 싶거나 남에게 루틴만 건네고 싶은 일이 있다. 그때 설정까지 딸려 가면
 * 받는 쪽의 볼륨과 알림이 조용히 바뀐다.
 *
 * 담을 것이 없는 덩어리(루틴 0개·기록 0건)는 꺼둔 채 잠근다. 설정은 언제나 있다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { C, GUTTER } from '../theme';
import { WhiteButton } from './Buttons';
import { Checkbox } from './Checkbox';
import { Sheet } from './Sheet';

export type ExportPick = { presets: boolean; records: boolean; settings: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  presetCount: number;
  recordCount: number;
  onExport: (pick: ExportPick) => void;
};

export function ExportSheet({ visible, onClose, presetCount, recordCount, onExport }: Props) {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<ExportPick>({
    presets: true,
    records: true,
    settings: true,
  });

  /**
   * 열 때마다 처음으로 되돌린다 — 있는 것은 전부 켠 상태.
   *
   * 지난번 선택을 기억하지 않는다. 내보내기는 어쩌다 한 번 하는 일이라, 몇 달 전에
   * 껐던 것이 그대로 꺼져 있으면 빠진 줄 모르고 파일을 넘긴다.
   */
  useEffect(() => {
    if (!visible) return;
    setPick({ presets: presetCount > 0, records: recordCount > 0, settings: true });
  }, [visible, presetCount, recordCount]);

  if (!visible) return null;

  const nothing = !pick.presets && !pick.records && !pick.settings;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('backup.selectTitle')}</Text>

      <View style={styles.list}>
        <Row
          label={t('backup.itemPresets', { count: presetCount })}
          on={pick.presets}
          empty={presetCount === 0}
          onToggle={() => setPick((p) => ({ ...p, presets: !p.presets }))}
        />
        <Row
          label={t('backup.itemRecords', { count: recordCount })}
          on={pick.records}
          empty={recordCount === 0}
          onToggle={() => setPick((p) => ({ ...p, records: !p.records }))}
        />
        <Row
          label={t('backup.itemSettings')}
          on={pick.settings}
          onToggle={() => setPick((p) => ({ ...p, settings: !p.settings }))}
          last
        />
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* 하나도 안 골랐으면 만들 파일이 없다 */}
        <WhiteButton
          label={t('backup.exportConfirm')}
          height={64}
          disabled={nothing}
          style={{ flex: 1 }}
          onPress={() => onExport(pick)}
        />
      </View>
    </Sheet>
  );
}

function Row({
  label,
  on,
  empty,
  onToggle,
  last,
}: {
  label: string;
  on: boolean;
  /** 담을 것이 없다 — 꺼둔 채 잠근다 */
  empty?: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        last && { borderBottomWidth: 0 },
        pressed && !empty && { opacity: 0.55 },
      ]}
      onPress={empty ? undefined : onToggle}
      disabled={empty}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: empty }}
      accessibilityLabel={label}
    >
      <Checkbox on={on && !empty} disabled={empty} />
      <Text style={[styles.rowLabel, empty && styles.rowLabelEmpty]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    paddingBottom: 6,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  list: { paddingHorizontal: GUTTER },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  rowLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: C.textPrimary },
  rowLabelEmpty: { color: C.textTertiary },
  footer: { flexDirection: 'row', paddingHorizontal: GUTTER, paddingTop: 18 },
});
