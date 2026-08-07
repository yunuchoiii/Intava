/**
 * 바텀시트 껍데기 — 배경 페이드인, 아래로 끌어 닫기.
 *
 * Modal의 slide 애니메이션은 시트만 움직이고 뒤 배경은 즉시 어두워진다.
 * 그래서 애니메이션을 직접 돌린다 — 배경은 서서히 깔리고, 시트는 스프링으로 올라온다.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ABS, C, E3, RADIUS } from '../theme';

/** 이만큼 끌어내리면 닫는다 */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.7;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Sheet({ visible, onClose, children, style }: Props) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current; // 0 = 닫힘, 1 = 열림
  const drag = useRef(new Animated.Value(0)).current; // 손가락으로 끌어내린 거리
  const closing = useRef(false);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  /**
   * 키보드가 가리는 높이.
   *
   * KeyboardAvoidingView는 쓰지 않는다. behavior="padding"은 시트 **안쪽에** 키보드
   * 높이만큼 여백을 넣는데, 시트는 이미 화면 바닥에 붙어 있어서 그만큼 통째로
   * 밀려 올라간다 — 위가 화면 밖으로 잘리고 아래에는 빈 공간이 생긴다.
   * 시트는 바닥을 키보드 위로 옮기고, 그만큼 키를 줄이는 게 맞다.
   */
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const onFrame = (e: { endCoordinates: { screenY: number } }) =>
      setKb(Math.max(0, screenH - e.endCoordinates.screenY));
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidShow', onFrame);
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [screenH]);

  const animateTo = useCallback(
    (to: number, after?: () => void) => {
      Animated.spring(anim, {
        toValue: to,
        useNativeDriver: true,
        speed: 18,
        bounciness: to === 1 ? 4 : 0,
      }).start(({ finished }) => finished && after?.());
    },
    [anim]
  );

  useEffect(() => {
    if (visible) {
      closing.current = false;
      drag.setValue(0);
      setMounted(true);
      animateTo(1);
    } else if (mounted) {
      animateTo(0, () => setMounted(false));
    }
  }, [visible, mounted, animateTo, drag]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  }, [onClose]);

  /** 손잡이 부근을 잡고 아래로 끌면 닫힌다 */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            Animated.timing(drag, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(close);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, close]
  );

  if (!mounted) return null;

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
    drag
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} />
      </Animated.View>

      <View style={[styles.wrap, { paddingBottom: kb }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            E3,
            // 남은 자리보다 커지지 않는다 — 커지면 위가 화면 밖으로 잘린다
            { maxHeight: screenH - kb - Math.max(insets.top, 24) - 12 },
            { transform: [{ translateY }] },
            style,
          ]}
        >
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[C.sheetTop, C.sheetBottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.border} pointerEvents="none" />

          {/* 손잡이 — 여기를 잡고 끌어내린다 */}
          <View style={styles.grabWrap} {...pan.panHandlers}>
            <View style={styles.grab} />
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: 'hidden',
  },
  border: {
    ...ABS,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  grabWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
});
