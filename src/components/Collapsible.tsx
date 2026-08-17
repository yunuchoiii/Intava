/**
 * 위에서 아래로 스르륵 열리는 상자와, 그 옆에서 도는 화살표.
 *
 * 내용의 높이는 미리 알 수 없으니 한 번 그려서 재고, 그 값을 목표로 애니메이션한다.
 * 재는 겹은 절대 배치라 바깥 높이에 영향을 주지 않는다 — 닫혀 있는 동안(높이 0)에도
 * 제 키대로 그려지고, 넘치는 부분은 잘린다.
 *
 * 높이는 네이티브 드라이버 대상이 아니라 JS로 돌지만, 한 번에 하나만 열린다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

const DURATION = 240;

export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  /**
   * 닫혀 있는 동안에는 내용을 아예 들이지 않는다.
   *
   * 휠 피커는 처음 그려질 때 지금 값으로 스크롤을 맞춘다. 숨은 채로 미리 마운트해 두면
   * 그 순간에 맞춰 놓은 자리가 열 때까지 남지 않아, 열면 첫 칸에 서 있다.
   * 닫는 애니메이션이 끝난 뒤에 내보낸다.
   */
  const [mounted, setMounted] = useState(open);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={{
        height: height
          ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, height] })
          : 0,
        opacity: anim,
        overflow: 'hidden',
      }}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <View style={styles.measured} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * 펼침 표시 — 열리면 아래를 가리키도록 돈다.
 *
 * 글자를 직접 돌리지 않는다. `›`는 자기 글자 상자 안에서 한쪽으로 치우쳐 그려져서,
 * 그대로 90도 돌리면 화살표가 줄 한가운데가 아니라 옆으로 비껴 앉는다.
 * 크기를 못 박은 정사각형 상자 안에 글자를 가운데 두고, 그 상자를 돌린다.
 */
export function Chevron({ open, color }: { open: boolean; color?: string }) {
  const spin = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(spin, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  return (
    <Animated.View style={[styles.chevronBox, { transform: [{ rotate }] }]}>
      {/* 색은 바깥에서 정할 수 있다 — 어두운 표면 위와 페이즈 색 위는 기준이 다르다 */}
      <Text style={[styles.chevron, !!color && { color }]}>›</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  measured: { position: 'absolute', left: 0, right: 0, top: 0 },
  chevronBox: {
    width: 22,
    height: 22,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { fontSize: 20, lineHeight: 22, color: C.textTertiary },
});
