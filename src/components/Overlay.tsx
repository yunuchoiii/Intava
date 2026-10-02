/**
 * 화면 위에 띄우는 겹 — 시트·툴팁이 여기로 올라온다. **RN Modal을 쓰지 않는다.**
 *
 * 예전에는 시트마다 `Modal`이었다. Modal은 UIKit이 따로 띄우는 뷰 컨트롤러라 우리
 * React 트리 밖에서 산다. 그래서 닫는 것과 여는 것이 한 프레임에 겹치거나, 닫히는
 * 도중 라우팅이 끼거나, 부모가 먼저 사라지면 **투명한 껍데기가 창에 남아 화면
 * 전체의 터치를 삼켰다.** 그 위에 onClosed 기다리기·프레임 띄우기·600ms 안전망을
 * 겹겹이 댔지만(b4fcda1, fd73925, a07f81f …) "가끔 화면이 안 눌린다"는 끝내
 * 남았다. 잔여 레이어는 우리 코드가 아니라 UIKit의 것이라 어느 타이밍을 맞춰도
 * 다른 타이밍이 남는다.
 *
 * 여기서는 시트가 그냥 **이 트리 안의 View**다. 뿌리 레이아웃의 OverlayHost가
 * Portal로 올라온 자식을 그린다. 안 보이면 안 그려진 것이고, 그려진 것은 React가
 * 걷는다 — 남을 껍데기 자체가 없다.
 *
 * 다만 뿌리 뷰에 그냥 두면 실행 화면 **아래**에 깔린다. 실행 화면은 네이티브
 * 스택의 transparentModal 라우트라 UIKit이 창 위에 따로 얹는 뷰 컨트롤러이고,
 * 우리 뿌리 뷰의 형제는 그 밑이다(완료 시트가 안 보였다 — 실측). 그래서
 * react-native-screens의 FullWindowOverlay를 쓴다. 창(UIWindow) 맨 위에 붙는
 * 평범한 뷰라 프레젠테이션 트랜지션이 없고, 언마운트하면 그냥 떨어진다 —
 * Modal이 남기던 것이 여기엔 없다. 창 위의 별도 뷰 계층이라 제스처 뿌리를 안에
 * 한 번 더 깐다(시트의 끌어내리기가 gesture-handler다).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

type Node = { key: string; node: React.ReactNode };
type Api = { set: (key: string, node: React.ReactNode) => void; remove: (key: string) => void };

const OverlayContext = createContext<Api | null>(null);
const NodesContext = createContext<Node[]>([]);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const api = useMemo<Api>(
    () => ({
      // 있으면 자리 그대로 갈아끼우고, 없으면 맨 위에 얹는다 — 먼저 연 것이 아래
      set: (key, node) =>
        setNodes((prev) =>
          prev.some((n) => n.key === key)
            ? prev.map((n) => (n.key === key ? { key, node } : n))
            : [...prev, { key, node }]
        ),
      remove: (key) => setNodes((prev) => prev.filter((n) => n.key !== key)),
    }),
    []
  );
  return (
    <OverlayContext.Provider value={api}>
      <NodesContext.Provider value={nodes}>{children}</NodesContext.Provider>
    </OverlayContext.Provider>
  );
}

/** 뿌리 레이아웃에서 스택·미니 바 **다음에** 둔다 — 그래야 그 위에 그려진다 */
export function OverlayHost() {
  const nodes = useContext(NodesContext);
  // 아무것도 없을 때는 창 위에 뷰를 두지 않는다 — 빈 겹이라도 창 맨 위에 있으면 무엇을 가릴지 모른다
  if (nodes.length === 0) return null;
  return (
    <FullWindowOverlay>
      {/* 빈 자리는 아래로 흘려보낸다 — backdrop이 없는 툴팁은 뒤를 살려 둔다 */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {nodes.map((n) => (
          <React.Fragment key={n.key}>{n.node}</React.Fragment>
        ))}
      </GestureHandlerRootView>
    </FullWindowOverlay>
  );
}

let seq = 0;

/**
 * 자식을 OverlayHost로 올린다. 내려가면(언마운트) 같이 걷힌다.
 *
 * 자식은 effect에서 올라가므로 호스트에 그려지는 것은 부모 렌더의 **한 커밋 뒤**다.
 * 보통은 보이지 않지만 제어 TextInput(`value`)은 이 한 박자에 걸린다 — RN이
 * 옛 값을 네이티브에 되썼다가 새 값으로 다시 쓰는 왕복이 한글 조합을 끊는다.
 * 시트 안의 글쓰기 칸은 `defaultValue`로 둔다(BlockSheet 참고).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const api = useContext(OverlayContext);
  if (!api) throw new Error('Portal used outside OverlayProvider');
  const key = useRef(`overlay-${++seq}`).current;
  // 매 렌더마다 갈아끼운다 — 자식이 바뀐 것을 호스트가 알 길이 이것뿐이다
  useEffect(() => {
    api.set(key, children);
  });
  const remove = useCallback(() => api.remove(key), [api, key]);
  useEffect(() => remove, [remove]);
  return null;
}
