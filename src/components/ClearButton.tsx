/**
 * 입력칸 오른쪽 끝의 ✕ — 한 번에 다 지운다.
 *
 * iOS의 `clearButtonMode`를 쓰지 않는다. 안드로이드에서는 아무것도 나오지 않는 데다,
 * 회색 원이 이 앱의 어두운 표면 위에서 겉돈다.
 *
 * 보이는 조건은 부르는 쪽이 정한다 — 입력 중이면서 글자가 있을 때만. 읽고만 있을 때는
 * 지우는 버튼이 나설 자리가 아니다.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { t } from '../i18n';
import { tapTick } from '../feedback';
import { C } from '../theme';

export function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tapTick();
        onPress();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('common.clear')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  pressed: { opacity: 0.5 },
  /** 전각이 아닌 ✕ — 원 안에서 광학적으로 가운데 오도록 행높이를 못 박는다 */
  glyph: { fontSize: 12, lineHeight: 14, fontWeight: '700', color: C.textSecondary },
});
