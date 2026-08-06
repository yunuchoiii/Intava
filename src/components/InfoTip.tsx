/**
 * ⓘ 툴팁 (핸드오프 5.2)
 *
 * 항목 설명은 상주 텍스트가 아니라 제목 옆 ⓘ 툴팁이다.
 * 아이콘 19×19 원, 툴팁은 아이콘 아래 30px, width 236~250.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ABS, C, E3 } from '../theme';

type Props = {
  text: string;
  open: boolean;
  onToggle: () => void;
  /** 화면 오른쪽 끝에 가까우면 툴팁을 왼쪽으로 붙인다 */
  align?: 'left' | 'right';
};

export function InfoTip({ text, open, onToggle, align = 'left' }: Props) {
  return (
    <View style={{ marginLeft: 7 }}>
      <Pressable
        onPress={onToggle}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="설명 보기"
        style={styles.icon}
      >
        <Text style={styles.i}>i</Text>
      </Pressable>
      {open && (
        <View
          style={[
            styles.tip,
            align === 'left' ? { left: -8 } : { right: -8 },
            E3,
            { shadowOffset: { width: 0, height: 12 } },
          ]}
        >
          {/* 뒤 내용이 비쳐 글자가 겹쳐 보이지 않도록 블러를 깐다 */}
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(52,52,62,0.98)', 'rgba(28,28,34,0.99)']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.tipBorder} pointerEvents="none" />
          <Text style={styles.tipText}>
            {/* **강조** 는 굵게 — 색 이름을 눈에 띄게 하려는 용도 */}
            {text.split('**').map((part, i) =>
              i % 2 === 1 ? (
                <Text key={i} style={{ fontWeight: '700' }}>
                  {part}
                </Text>
              ) : (
                part
              )
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  i: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
    color: '#C9CCD2',
    lineHeight: 15,
  },
  tip: {
    position: 'absolute',
    top: 30,
    width: 244,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    overflow: 'hidden',
    zIndex: 20,
  },
  tipBorder: {
    ...ABS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: C.textPrimary,
  },
});
