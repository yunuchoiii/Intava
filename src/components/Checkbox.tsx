/**
 * 체크박스 — 켜지면 흰 면에 검은 ✓, 꺼지면 빈 테두리.
 *
 * 그림만 그린다. 손가락은 이것을 감싸는 쪽이 받는다 — 22pt짜리 사각형은 그
 * 자체로는 너무 작아서, 어디를 눌러야 켜지는지가 이 컴포넌트가 정할 일이 아니다.
 * (종목 편집 시트에서는 라벨까지, 순서 시트에서는 체크박스 둘레까지가 누르는 자리다.)
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export const CHECKBOX_SIZE = 22;

export function Checkbox({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <View style={[styles.box, on && styles.boxOn, disabled && styles.disabled]}>
      {on && <Text style={styles.check}>✓</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: C.white, borderColor: C.white },
  /** 못 바꾸는 자리 — 상태는 그대로 읽히되 손댈 곳이 아님이 보여야 한다 */
  disabled: { opacity: 0.4 },
  check: { fontSize: 14, fontWeight: '800', color: C.onWhite, lineHeight: 17 },
});
