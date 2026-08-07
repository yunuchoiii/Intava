/**
 * ⓘ 툴팁 (핸드오프 5.2)
 *
 * 항목 설명은 상주 텍스트가 아니라 제목 옆 ⓘ 툴팁이다.
 *
 * 행 안에 그대로 그리면 두 가지가 안 된다 — 뒤에 오는 행들이 위에 덮이고,
 * 화면 끝 행에서는 툴팁이 잘린다. 그래서 화면 위에 띄우고(Modal), 아이콘의
 * 실제 위치를 재서 그 아래에 놓되 화면 밖으로 나가지 않게 가둔다.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ABS, C, E3 } from '../theme';

type Props = {
  text: string;
  open: boolean;
  onToggle: () => void;
};

const WIDTH = 244;
const MARGIN = 12;
const GAP = 8;

export function InfoTip({ text, open, onToggle }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const iconRef = useRef<View>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, h: 0 });
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  /** 열릴 때 아이콘의 화면상 위치를 잰다 — 스크롤 위치에 따라 매번 달라진다 */
  const measure = useCallback(() => {
    iconRef.current?.measureInWindow((x, y, _w, h) => setAnchor({ x, y, h }));
  }, []);

  useEffect(() => {
    if (open) {
      measure();
      setMounted(true);
      Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
  }, [open, measure, fade, mounted]);

  // 화면 밖으로 나가지 않게 가둔다
  const left = Math.min(Math.max(anchor.x - 8, MARGIN), Math.max(MARGIN, screenW - WIDTH - MARGIN));
  const below = anchor.y + anchor.h + GAP;
  const flipUp = below > screenH - 160;
  const top = flipUp ? Math.max(MARGIN, anchor.y - GAP - 120) : below;

  return (
    <View style={{ marginLeft: 7 }}>
      <Pressable
        ref={iconRef}
        onPress={onToggle}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={text}
        style={styles.icon}
      >
        <Text style={styles.i}>i</Text>
      </Pressable>

      <Modal visible={mounted} transparent animationType="none" onRequestClose={onToggle}>
        {/* 바깥을 누르면 닫힌다 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
        <Animated.View style={[styles.tip, { left, top, opacity: fade }, E3]}>
          {/* 툴팁 자신을 눌러도 닫힌다 — 읽고 나면 없애고 싶은 것이 자연스럽다 */}
          <Pressable onPress={onToggle}>
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
          </Pressable>
        </Animated.View>
      </Modal>
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
    width: WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tipBorder: {
    ...ABS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tipText: {
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 13,
    lineHeight: 20,
    color: C.textPrimary,
  },
});
