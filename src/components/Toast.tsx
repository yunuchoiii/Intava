/**
 * 토스트 — 해낸 일을 한 줄로 알리고 스스로 사라진다.
 *
 * 저장·삭제 같은 것은 성공해도 화면이 크게 달라지지 않는다. 편집에서 저장하면
 * 그냥 앞 화면으로 돌아갈 뿐이라, 눌린 것이 먹혔는지 손에 남는 게 없다. 그 한
 * 마디를 여기서 준다.
 *
 * **묻지 않는 것에만 쓴다.** 되돌릴 수 없는 일이나 답이 필요한 일은 Alert의
 * 자리다. 토스트는 읽지 않아도 아무 일이 없어야 한다 — 그래서 누를 것을 달지
 * 않고, 화면을 가리지 않는 아래쪽에 잠깐 떠 있다 사라진다.
 *
 * 미니 바 위에 앉힌다. 타이머가 도는 중에도 바를 덮지 않아야 한다.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniTimerSpace } from './MiniTimer';
import { C, E3 } from '../theme';

/** 떠 있는 시간 — 한 줄을 읽고도 남을 만큼만 */
const HOLD_MS = 1800;

const ToastCtx = createContext<(message: string) => void>(() => {});

/** 어디서든 부른다 — `const toast = useToast(); toast(t('...'))` */
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setMessage(null));
  }, [anim]);

  /**
   * 잇따라 부르면 뒤엣것으로 갈아끼운다 — 두 개를 쌓지 않는다. 지우고 다시
   * 띄우면 그 사이 한 번 깜빡이므로, 글자만 바꾸고 시계를 새로 건다.
   */
  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, HOLD_MS);
    },
    [anim, hide]
  );

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {message != null && <Bubble message={message} anim={anim} />}
    </ToastCtx.Provider>
  );
}

function Bubble({ message, anim }: { message: string; anim: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();
  const rise = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
    [anim]
  );

  return (
    <Animated.View
      // 손가락을 받지 않는다 — 아래에 있는 것을 가리기만 하고 막지는 않는다
      pointerEvents="none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + 20 + miniSpace, opacity: anim, transform: [{ translateY: rise }] },
      ]}
    >
      <View style={[styles.bubble, E3]}>
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    // 미니 바(10)보다 위, 스플래시(100)보다 아래
    zIndex: 60,
  },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
    color: C.textPrimary,
  },
});
