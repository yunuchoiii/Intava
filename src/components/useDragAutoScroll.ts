/**
 * 끌고 있는 손가락이 목록의 위·아래 끝에 닿으면 목록이 스스로 흐른다.
 *
 * 없으면 보이는 만큼 안에서만 순서를 바꿀 수 있다 — 일곱 번째 종목을 맨 위로
 * 올리려면 화면 밖으로 끌고 가야 하는데, 거기서는 아무 일도 일어나지 않는다.
 *
 * **손가락 자리는 화면 좌표(pageY)로 읽는다.** 행 안쪽 좌표는 행이 손을 따라
 * 움직이는 중이라 기준이 되지 못하고, 스크롤뷰 안쪽 좌표는 스크롤되는 그 값이라
 * 자기 자신을 재는 꼴이 된다. 그래서 스크롤뷰가 화면 어디에 놓였는지도 화면
 * 좌표로 재 둔다(measureInWindow).
 *
 * **흐르는 동안 끌리는 행을 손가락 밑에 붙여 두는 것은 목록 쪽 일이다.** 손가락이
 * 멈춰 있어도 목록이 움직이면 행은 뒤로 밀려나므로, 흐른 만큼(delta)을 행의
 * 이동값에 더해 줘야 한다. 손가락이 가만히 있는 동안에는 제스처 콜백이 오지
 * 않으니, 흐를 때마다 등록된 콜백으로 알린다.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { ScrollView } from 'react-native';

/** 이 끝에서 이만큼 안쪽부터 흐르기 시작한다 */
const EDGE = 64;
/** 가장 깊이 밀었을 때의 속도 — 초당 이만큼 */
const MAX_PER_SEC = 820;

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

export type AutoScroll = ReturnType<typeof useDragAutoScroll>;

export function useDragAutoScroll() {
  const ref = useRef<ScrollView>(null);
  /** 스크롤뷰가 화면에서 차지한 자리 */
  const box = useRef({ top: 0, height: 0 });
  const offset = useRef(0);
  const contentH = useRef(0);
  /** 이번 드래그가 시작될 때의 오프셋 — 지금과의 차이가 delta다 */
  const base = useRef(0);
  /** px/sec. 양수면 아래로 흐른다 */
  const speed = useRef(0);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastT = useRef(0);
  const onShift = useRef<((delta: number) => void) | null>(null);

  const measure = useCallback(() => {
    const node = ref.current as unknown as Measurable | null;
    node?.measureInWindow?.((_x, y, _w, h) => {
      box.current = { top: y, height: h };
    });
  }, []);

  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    speed.current = 0;
  }, []);

  const tick = useCallback(() => {
    frame.current = requestAnimationFrame(tick);
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastT.current) / 1000);
    lastT.current = now;
    if (!speed.current) return;

    const max = Math.max(0, contentH.current - box.current.height);
    const next = Math.max(0, Math.min(max, offset.current + speed.current * dt));
    if (next === offset.current) return; // 끝에 닿았다 — 더 흐를 곳이 없다
    offset.current = next;
    ref.current?.scrollTo({ y: next, animated: false });
    onShift.current?.(next - base.current);
  }, []);

  const run = useCallback(() => {
    if (frame.current != null) return;
    lastT.current = Date.now();
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  return useMemo(
    () => ({
      ref,
      /** 스크롤뷰에 그대로 펼쳐 준다 */
      props: {
        ref,
        scrollEventThrottle: 16,
        onLayout: () => measure(),
        onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
          // 우리가 흐르게 하는 동안에는 우리 값이 진실이다. 스크롤 알림은 한 박자
          // 늦게 오므로 그대로 받으면 방금 올린 자리를 옛 값으로 되돌려 행이 떤다.
          if (frame.current == null) offset.current = e.nativeEvent.contentOffset.y;
        },
        onContentSizeChange: (_w: number, h: number) => {
          contentH.current = h;
        },
      },
      /**
       * 집어 든 순간 — 기준 오프셋을 잡고 **자리를 버린 뒤 다시 잰다.**
       *
       * 버리는 것이 핵심이다. onLayout으로 잰 자리는 믿을 수 없다 — 시트는
       * translateY 변형으로 올라오는데 변형은 레이아웃을 바꾸지 않아서, 아직
       * 화면 아래에 있을 때 한 번 재고는 다시 재지 않는다. 그 자리를 그대로
       * 쓰면 손가락이 늘 위쪽 끝에 있는 것으로 읽혀 목록이 제멋대로 흐르고,
       * 흐른 만큼이 행의 이동값에 더해져 엉뚱한 자리에 떨어진다 — 시트를 처음
       * 열고 첫 번째로 옮길 때 순서가 어긋나던 것이 그것이다.
       *
       * measureInWindow의 답은 다음 프레임에 온다. 그 사이에는 height가 0이라
       * track이 아무것도 하지 않는다 — 잘못 흐르느니 한 프레임 늦게 흐른다.
       */
      begin: (notify: (delta: number) => void) => {
        box.current = { top: 0, height: 0 };
        measure();
        base.current = offset.current;
        onShift.current = notify;
      },
      /** 끌고 가는 손가락의 화면 높이 */
      track: (pageY: number) => {
        const { top, height } = box.current;
        // 아직 자리를 모른다 — 어림잡아 흐르게 하느니 가만히 있는다
        if (!height) {
          speed.current = 0;
          stop();
          return;
        }
        const overTop = top + EDGE - pageY;
        const overBottom = pageY - (top + height - EDGE);
        let s = 0;
        if (overTop > 0) s = -MAX_PER_SEC * Math.min(1, overTop / EDGE);
        else if (overBottom > 0) s = MAX_PER_SEC * Math.min(1, overBottom / EDGE);
        speed.current = s;
        if (s) run();
        else stop();
      },
      /** 놓았다 */
      end: () => {
        stop();
        onShift.current = null;
      },
      /** 집어 든 뒤로 목록이 흐른 거리 */
      delta: () => offset.current - base.current,
    }),
    [measure, run, stop]
  );
}
