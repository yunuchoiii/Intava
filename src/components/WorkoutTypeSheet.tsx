/**
 * 운동 종류 고르기 — 건강·피트니스 앱에 이 루틴을 무엇으로 남길지.
 *
 * 줄을 누르면 곧바로 고르고 닫힌다. 고를 것이 열 개뿐이라 확인 단계를 두지 않는다.
 *
 * 「건강 앱에 운동 기록」이 꺼져 있으면 여기서 고른 종류는 아무 데도 남지 않는다. 고르는
 * 그 자리에서 빨간 줄로 알리고, 누르면 설정으로 데려간다 — 모르고 고르면 왜 피트니스에
 * 안 남는지 알 길이 없다.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { C, GUTTER } from '../theme';
import { WORKOUT_TYPES, type WorkoutType } from '../types';
import { PressBox } from './PressBox';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  value: WorkoutType;
  onPick: (type: WorkoutType) => void;
  onClose: () => void;
  /** 건강 앱 기록이 꺼져 있다 — 빨간 안내 줄을 세운다 */
  healthOff?: boolean;
  /** 안내 줄을 눌렀다 — 부르는 쪽이 시트를 닫고 설정을 연다 */
  onOpenSettings?: () => void;
  /** 완전히 내려간 뒤 — 이어서 화면을 옮길 때 기다린다 */
  onClosed?: () => void;
};

export function WorkoutTypeSheet({
  visible,
  value,
  onPick,
  onClose,
  healthOff,
  onOpenSettings,
  onClosed,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} onClose={onClose} onClosed={onClosed}>
      <Text style={styles.title}>{t('edit.workoutType')}</Text>
      <Text style={styles.note}>{t('edit.workoutTypeNote')}</Text>
      {healthOff && (
        <PressBox
          onPress={onOpenSettings}
          scaleTo={0.98}
          dim={0}
          style={styles.warnRow}
          accessibilityLabel={t('edit.workoutTypeHealthOff')}
        >
          <Text style={styles.warn}>
            {t('edit.workoutTypeHealthOff')} <Text style={styles.warnLink}>{t('edit.workoutTypeOpenSettings')} ›</Text>
          </Text>
        </PressBox>
      )}
      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER - 12, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {WORKOUT_TYPES.map((type) => {
          const on = type === value;
          return (
            <PressBox
              key={type}
              onPress={() => onPick(type)}
              radius={14}
              scaleTo={0.98}
              dim={0.22}
              style={styles.row}
              accessibilityLabel={t(`workoutType.${type}`)}
            >
              <Text style={[styles.label, on && styles.labelOn]}>{t(`workoutType.${type}`)}</Text>
              {on && <Text style={styles.check}>✓</Text>}
            </PressBox>
          );
        })}
      </ScrollView>
      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  note: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 10,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSecondary,
  },
  warnRow: { paddingHorizontal: GUTTER, paddingBottom: 12, marginTop: -2 },
  warn: { fontSize: 14, lineHeight: 20, color: C.danger },
  warnLink: { fontWeight: '700', color: C.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  label: { flex: 1, fontSize: 17, fontWeight: '500', color: C.textSecondary },
  labelOn: { fontWeight: '700', color: C.textPrimary },
  check: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
});
