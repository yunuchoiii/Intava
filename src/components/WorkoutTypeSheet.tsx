/**
 * 운동 종류 고르기 — 건강·피트니스 앱에 이 루틴을 무엇으로 남길지.
 *
 * 줄을 누르면 곧바로 고르고 닫힌다. 고를 것이 열 개뿐이라 확인 단계를 두지 않는다.
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
};

export function WorkoutTypeSheet({ visible, value, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('edit.workoutType')}</Text>
      <Text style={styles.note}>{t('edit.workoutTypeNote')}</Text>
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
