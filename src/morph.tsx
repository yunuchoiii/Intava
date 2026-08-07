/**
 * 실행 화면 ↔ 미니 바 — 하나의 몸짓으로 잇는다.
 *
 * 둘은 서로 다른 곳에 산다. 실행 화면은 라우트고, 미니 바는 루트에 얹힌 겹이다.
 * 같은 값을 보고 함께 움직여야 "작아지면서 바로 바뀌는" 것처럼 읽힌다.
 *
 * 0이면 실행 화면이 가득 찬 상태, 1이면 미니 바로 접힌 상태. 그 사이는 손가락이 쥔다.
 *
 * 값이 둘인 이유: 네이티브 드라이버는 transform과 opacity만 받는다. 모서리 반경은
 * JS 쪽에서 돌아야 하는데, 하나의 Animated.Value를 두 드라이버에 걸면 RN이 거부한다.
 */
import { usePathname } from 'expo-router';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

type Opts = {
  /** 주면 timing, 없으면 spring */
  duration?: number;
  /** 손을 뗀 순간의 속도 (값/초) — 던진 기세를 이어받는다 */
  velocity?: number;
  onDone?: () => void;
};

type MorphApi = {
  /** transform · opacity — 네이티브 드라이버 */
  p: Animated.Value;
  /** borderRadius — JS 드라이버. p와 같은 값을 따라간다 */
  radius: Animated.Value;
  /** 손가락이 값을 쥐고 있는 동안 참 — 화면이 제멋대로 펼쳐지지 않게 한다 */
  dragging: React.MutableRefObject<boolean>;
  /**
   * 실행 화면을 접어 내린 시각.
   *
   * 끌어내려 홈에 닿자마자 화면이 다시 열리는 일이 있었다. 손을 뗀 뒤 화면이
   * 사라지기까지 260ms가 걸리는데, 그 사이에 늦게 도착한 손짓이 미니 바에 닿으면
   * 방금 닫은 것을 도로 여는 셈이 된다. 접자마자 잠깐은 열지 않는다.
   */
  collapsedAt: React.MutableRefObject<number>;
  set: (v: number) => void;
  animate: (to: number, opts?: Opts) => void;
  /** 돌고 있는 애니메이션을 멈춘다 — 손가락이 값을 넘겨받기 전에 */
  stop: () => void;
};

const Ctx = createContext<MorphApi | null>(null);

export function MorphProvider({ children }: { children: React.ReactNode }) {
  const p = useRef(new Animated.Value(1)).current;
  const radius = useRef(new Animated.Value(1)).current;
  const dragging = useRef(false);
  const collapsedAt = useRef(0);
  const pathname = usePathname();

  const api = useMemo<MorphApi>(() => {
    const set = (v: number) => {
      p.setValue(v);
      radius.setValue(v);
    };

    const animate = (to: number, opts: Opts = {}) => {
      const { duration, velocity = 0, onDone } = opts;
      const make = (v: Animated.Value, useNativeDriver: boolean) =>
        duration != null
          ? Animated.timing(v, {
              toValue: to,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver,
            })
          : Animated.spring(v, {
              toValue: to,
              velocity,
              stiffness: 260,
              damping: 30,
              mass: 1,
              useNativeDriver,
            });

      make(radius, false).start();
      make(p, true).start(({ finished }) => {
        if (finished) onDone?.();
      });
    };

    const stop = () => {
      p.stopAnimation();
      radius.stopAnimation();
    };

    return { p, radius, dragging, collapsedAt, set, animate, stop };
  }, [p, radius]);

  /**
   * 실행 화면이 이 몸짓을 거치지 않고 사라지는 길도 있다 — 완료 화면으로 교체되거나,
   * ✕로 끝내거나. 그때 값이 0에 남아 있으면 미니 바가 투명한 채로 숨어버린다.
   * 실행 화면을 벗어나면 접힌 상태로 되돌려 둔다.
   *
   * 그리고 안전망 하나. 이 값이 어중간한 데서 멈추면 화면이 반투명하게 어긋난 자리에
   * 굳어 아무것도 눌리지 않는다 — 제스처가 놓임/취소 어느 쪽으로도 끝나지 못하면
   * 그렇게 될 수 있다. 화면이 정해진 뒤 잠깐 기다렸다가, 손가락이 쥐고 있지 않으면
   * 제자리로 돌려놓는다. 원인을 못 찾더라도 갇히지는 않게.
   */
  useEffect(() => {
    const rest = pathname === '/run' ? 0 : 1;
    if (rest === 1 && !dragging.current) api.set(1);
    const id = setTimeout(() => {
      if (!dragging.current) api.set(rest);
    }, 900);
    return () => clearTimeout(id);
  }, [pathname, api]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useMorph(): MorphApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useMorph는 MorphProvider 안에서만 쓸 수 있다');
  return api;
}
