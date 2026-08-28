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
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissKeyboardOnEmptyTap } from './Screen';
import { ABS, C, E3, RADIUS } from '../theme';

/** 이만큼 끌어내리면 닫는다 */
const DISMISS_DISTANCE = 110;
/** 손을 떼는 순간의 속도(px/초) — 짧게 툭 쳐도 닫힌다 */
const DISMISS_VELOCITY = 700;
/** 세로로 이만큼 움직여야 「끌어내리는 중」으로 친다 */
const DRAG_SLOP = 8;

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * 시트가 화면에서 **완전히 내려간 뒤** 불린다.
   *
   * 이어서 다른 시트를 열어야 할 때 이걸 기다린다. iOS는 한 화면이 동시에 두
   * 모달을 띄우지 못해서, 닫는 것과 여는 것이 겹치면 뒤엣것이 아예 안 뜨고
   * 앞엣것의 투명한 껍데기만 남아 화면 전체의 터치를 먹는다.
   */
  onClosed?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Sheet({ visible, onClose, onClosed, children, style }: Props) {
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

  /** 뒤늦게 도는 정리가 "지금도 닫힌 상태인가"를 물어볼 창구 */
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (visible) {
      closing.current = false;
      drag.setValue(0);
      setMounted(true);
      animateTo(1);
    } else if (mounted) {
      /*
        내리는 일을 **애니메이션 완주에 매달지 않는다.**

        예전에는 `animateTo(0, () => setMounted(false))` 하나였는데, 닫힘이
        중간에 끊기면 콜백이 오지 않아 `mounted`가 true로 굳었다. `visible`은
        이미 false라 이 effect도 다시 돌지 않는다. 그러면 **불투명도 0짜리 전면
        Modal이 남아 화면 전체의 터치를 삼킨다** — `closing.current`까지 true라
        backdrop을 눌러도 `onClose`가 다시 불리지 않아 빠져나갈 길이 없다.
      */
      let done = false;
      const drop = () => {
        // 그 사이 다시 열렸으면 내리지 않는다
        if (done || visibleRef.current) return;
        done = true;
        /*
          다음에 열릴 때를 위해 빗장을 푼다. 여는 쪽(visible=true)에서도 풀지만,
          거기까지 못 가는 길이 있다 — 부모가 열지 않은 채로 두면 closing이 참으로
          굳어 backdrop을 눌러도 onClose가 다시 불리지 않는다.
        */
        closing.current = false;
        setMounted(false);
        onClosed?.();
      };
      animateTo(0, drop);
      const id = setTimeout(drop, 600);
      return () => clearTimeout(id);
    }
  }, [visible, mounted, animateTo, drag, onClosed]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    /*
      키보드를 먼저 내린다. 글쓰기 칸에 초점이 남은 채로 Modal이 걷히면
      first responder가 사라진 뷰를 가리킨 채 남아, 키보드만 떠 있거나 그 자리가
      안 눌리는 상태가 된다.
    */
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  /**
   * 손잡이를 잡고 아래로 끌면 닫힌다.
   *
   * **PanResponder로는 안 된다.** 시트는 Modal 안에 있는데, 그 안에서는 손이 닿는
   * 것만 묻고(`onStartShouldSetResponder`) **움직임은 한 번도 묻지 않는다**
   * (`onMoveShouldSetResponder`가 영영 안 불린다). 계측해 보니 raw `onTouchMove`가
   * 서른 번 도착하는 동안 move 협상은 0번이었다 — 손짓의 주인을 정하는 협상이
   * Modal 안에서 반쪽만 도는 것이고, 그래서 닫기 제스처가 통째로 죽어 있었다.
   *
   * gesture-handler는 그 협상을 거치지 않고 네이티브 제스처로 직접 잡는다. Modal은
   * 별도의 뷰 계층이라 안쪽에 GestureHandlerRootView를 한 번 더 깔아야 인식된다.
   *
   * 손잡이 자리에만 건다. 시트 몸통 전체에 걸면 안쪽 스크롤·휠 피커와 세로로 다툰다.
   */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(DRAG_SLOP) // 아래로 끌 때만 가져간다
        .failOffsetY(-DRAG_SLOP) // 위로 올리는 손짓은 넘긴다
        .onUpdate((e) => drag.setValue(Math.max(0, e.translationY)))
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            Animated.timing(drag, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(close);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        })
        // Animated.Value를 만지므로 JS 스레드에서 돈다
        .runOnJS(true),
    [drag, close]
  );

  if (!mounted) return null;

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
    drag
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      {/* Modal은 별도의 뷰 계층이라 제스처 뿌리를 여기 한 번 더 깐다 */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} />
        </Animated.View>

        <View
          style={[styles.wrap, { paddingBottom: kb }]}
          pointerEvents="box-none"
          {...dismissKeyboardOnEmptyTap()}
        >
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
            <GestureDetector gesture={pan}>
              <View style={styles.grabWrap}>
                <View style={styles.grab} />
              </View>
            </GestureDetector>

            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
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
  // 막대는 5px이지만 손이 잡는 자리는 그보다 넉넉해야 한다
  grabWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
});
