/**
 * 종목 목록 (핸드오프 5.2)
 * 탭하면 종목 편집 시트, 꾹 누르면 순서 변경.
 *
 * **밀어서 삭제는 없다.** 지우는 길은 시트 안의 삭제 버튼 하나다.
 *
 * 한동안 밀어서 지우게 두었는데 끝내 손에 붙지 않았다. 한 손가락을 두고 세 동작이
 * 다투는데(세로 스크롤 · 가로 삭제 · 꾹 눌러 옮기기) PanResponder에는 "동시에 인식"이나
 * "저것이 실패하면 이것" 같은 개념이 없어, 판정을 전부 손으로 해야 했다. 한 구멍을
 * 막으면 다른 데서 샜다. 게다가 확인 단계가 없어 임계값을 낮추면 무섭고 높이면
 * 힘들었다 — 어떤 숫자를 골라도 한쪽이 나빴다.
 *
 * 지우는 일은 드물고 되돌릴 수 없다. 시트를 한 번 여는 값은 그 대가로 싸다.
 * 남은 두 동작은 시간으로 깨끗이 갈린다 — 바로 움직이면 스크롤, 머물렀다 움직이면 끌기.
 *
 * 제스처 규칙 셋.
 *
 * 1. **팬 리스폰더는 한 번만 만든다.** 드래그 중에는 매 프레임 부모가 리렌더되는데,
 *    그때 PanResponder를 새로 만들면 제스처 누적값(gestureState)이 0부터 다시
 *    시작해 행이 한 칸만 움직이고 멈춘다. 콜백은 ref로 최신 것을 읽는다.
 * 2. **캡처 단계로 잡는다.** 안쪽 Pressable이 이미 리스폰더를 가진 뒤라
 *    버블 단계(onMoveShouldSetPanResponder)로는 넘겨받지 못한다.
 * 3. **손을 대는 순간은 잡지 않는다.** 잡아 버리면 목록 전체가 세로로 스크롤되지
 *    않는다. 길게 누르기는 캡처 단계에서 시계만 걸어두고 리스폰더는 넘기지 않는다.
 */
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { selectionTick } from '../feedback';
import { blockSummary } from '../engine/labels';
import { t } from '../i18n';
import { ABS, C, E2, TABULAR } from '../theme';
import type { AutoScroll } from './useDragAutoScroll';
import type { Block } from '../types';

export const ROW_H = 62;
/** 이만큼 머물렀다 움직이면 순서를 옮기려는 손이다 */
const LONG_PRESS_MS = 280;

type Props = {
  blocks: Block[];
  /** 없으면 행은 눌리지 않는다 — 실행 중 순서 시트에는 열어볼 편집 화면이 없다 */
  onPress?: (block: Block) => void;
  onReorder: (next: Block[]) => void;
  /** 끌고 있는 동안 부모 스크롤을 멈추기 위한 신호 */
  onDragActive?: (active: boolean) => void;
  /**
   * 앞에서 이만큼은 굳어 있다 — 집어 들 수도, 그 위로 떨어뜨릴 수도 없다.
   * 실행 중에는 이미 지나간 종목이 여기 해당한다. 지난 배치가 바뀌면 흐른 시간이
   * 가리키는 자리가 어긋난다.
   */
  lockedCount?: number;
  /**
   * 감싸는 스크롤뷰를 끌 때 따라 흐르게 하는 손잡이(useDragAutoScroll).
   * 없으면 보이는 만큼 안에서만 옮길 수 있다.
   */
  autoScroll?: AutoScroll;
};

export function BlockList({
  blocks,
  onPress,
  onReorder,
  onDragActive,
  lockedCount = 0,
  autoScroll,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  // 안전망 — 목록이 바뀌면(순서 변경·추가·삭제) 드래그 상태를 반드시 턴다.
  // 제스처가 어떤 경로로 끝나든 집어 든 표시가 남아 있으면 안 된다.
  useLayoutEffect(() => {
    setDragFrom(null);
    setDragTo(null);
    onDragActive?.(false);
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ height: blocks.length * ROW_H }}>
      {blocks.map((b, i) => (
        <Row
          key={b.id}
          index={i}
          block={b}
          count={blocks.length}
          locked={i < lockedCount}
          floor={lockedCount}
          autoScroll={autoScroll}
          dragFrom={dragFrom}
          dragTo={dragTo}
          onPress={onPress ? () => onPress(b) : undefined}
          onDragStart={(from) => {
            setDragFrom(from);
            setDragTo(from);
            onDragActive?.(true);
          }}
          onDragMove={setDragTo}
          onDragEnd={(from, to) => {
            setDragFrom(null);
            setDragTo(null);
            onDragActive?.(false);
            if (from === to) return;
            const next = [...blocks];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            onReorder(next);
          }}
        />
      ))}
    </View>
  );
}

type RowProps = {
  index: number;
  block: Block;
  count: number;
  /** 이 행은 굳었다 — 집어 들 수 없고 흐리게 그린다 */
  locked: boolean;
  /** 떨어뜨릴 수 있는 첫 자리 — 굳은 자리 위로는 못 올린다 */
  floor: number;
  dragFrom: number | null;
  dragTo: number | null;
  autoScroll?: AutoScroll;
  onPress?: () => void;
  onDragStart: (from: number) => void;
  onDragMove: (to: number) => void;
  onDragEnd: (from: number, to: number) => void;
};

function Row(props: RowProps) {
  const { index, block, count, dragFrom, dragTo } = props;

  const dy = useRef(new Animated.Value(0)).current;
  /** 비켜서는 행의 이동 — 값이 튀지 않고 흘러가야 한다 */
  const slide = useRef(new Animated.Value(0)).current;
  /** 집어 들렸는지 — 0이면 목록에 누워 있고 1이면 떠 있다 */
  const lift = useRef(new Animated.Value(0)).current;

  /**
   * 세로 이동은 **둘을 더해서** 하나의 값으로 넘긴다.
   *
   * 예전에는 `isDragged ? dy : slide`로 골라 넘겼는데, 그러면 집어 드는 순간
   * 이 자리를 움직이는 값이 통째로 바뀐다. 네이티브 드라이버는 화면이 처음 그려질 때
   * 값과 속성을 이어붙이고 그 연결을 유지하기 때문에, 바뀐 값이 붙지 않아
   * 집어 든 행만 제자리에 굳어 버렸다 — 다른 행은 밀려나는데 정작 끌리는 것이 안 움직였다.
   * 더해서 넘기면 연결이 처음부터 끝까지 하나다. 집어 든 행은 slide가 0이고,
   * 나머지 행은 dy가 0이라 서로 방해하지 않는다.
   */
  const shiftY = useMemo(() => Animated.add(dy, slide), [dy, slide]);
  const liftScale = useMemo(
    () => lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
    [lift]
  );

  /** 리스폰더를 한 번만 만들기 위해, 매 렌더 바뀌는 값들은 ref로 넘긴다 */
  const live = useRef(props);
  live.current = props;

  const isDragged = dragFrom === index;

  /** 드래그 중인 행이 비켜간 자리만큼 다른 행을 밀어둔다 */
  /**
   * 값을 제자리로 되돌린다 — **멈춰 세운 다음에** 되돌린다.
   *
   * 네이티브 드라이버로 도는 애니메이션은 setValue만으로 멈추지 않는다. JS 쪽
   * 값만 0이 되고 네이티브는 원래 목표를 향해 계속 가서, 비켜서 있던 행이
   * 한 칸 밀린 채로 굳는다 — 드롭한 뒤 배경도 없이 옆 행과 겹쳐 보이던 것이
   * 그것이다. 밀린 채로 남았으니 그 다음 순서도 어긋난 자리에서 셈해진다.
   *
   * 예전에는 잘 드러나지 않았다. 드롭은 dy 스프링이 끝난 **뒤에** 확정되는데
   * 그 사이에 비켜서던 스프링도 대개 끝나 있었기 때문이다. 목록이 스스로
   * 흐르기 시작하면서 마지막 순간까지 도착 칸이 바뀌게 되자 드러났다.
   */
  const reset = useCallback((v: Animated.Value) => {
    v.stopAnimation();
    v.setValue(0);
  }, []);

  const shift = useMemo(() => {
    if (dragFrom === null || dragTo === null || isDragged) return 0;
    if (dragFrom < index && dragTo >= index) return -ROW_H;
    if (dragFrom > index && dragTo <= index) return ROW_H;
    return 0;
  }, [dragFrom, dragTo, index, isDragged]);

  // useEffect가 아니라 useLayoutEffect다. 일반 이펙트는 화면이 한 번 그려진
  // 뒤에 돌아서, 새 순서가 반영된 자리 위에 옛 이동값이 남은 프레임이 한 번
  // 보인다 — 그게 드롭할 때 느껴지는 버벅임이다.
  useLayoutEffect(() => {
    // 드래그가 끝나면 배열이 이미 새 순서다. 이동값을 즉시 0으로 되돌린다.
    if (dragFrom === null) {
      reset(slide);
      return;
    }
    Animated.spring(slide, {
      toValue: shift,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [shift, dragFrom, slide, reset]);

  /**
   * 순서가 확정되어 이 행의 자리(top)가 바뀌는 바로 그 커밋에서 이동값을 턴다.
   * 애니메이션이 끝나자마자 0으로 만들면, 배열이 커밋되기 전 한 프레임 동안
   * 원래 자리로 되돌아갔다가 새 자리로 튀어 보인다.
   */
  /** 집어 들면 떠오르고, 놓으면 가라앉는다 */
  useLayoutEffect(() => {
    Animated.spring(lift, {
      toValue: isDragged ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [isDragged, lift]);

  // 자리가 바뀌었으면 손으로 옮긴 몫은 이미 새 자리에 녹아 있다 — 확실히 세우고 턴다
  useLayoutEffect(() => {
    reset(dy);
  }, [index, dy, reset]);

  const targetIndex = useCallback((gdy: number) => {
    const { index: i, count: n, floor } = live.current;
    return Math.max(floor, Math.min(n - 1, i + Math.round(gdy / ROW_H)));
  }, []);

  /**
   * 손가락이 마지막으로 알려준 이동량. 목록이 스스로 흐르는 동안에는 제스처
   * 콜백이 오지 않으므로, 흐른 만큼을 여기에 더해 자리를 다시 잡는다.
   */
  const lastGdy = useRef(0);

  /** 행을 이만큼 옮기고, 그 자리에 맞는 도착 칸을 알린다 */
  const apply = useCallback(
    (v: number) => {
      dy.setValue(v);
      live.current.onDragMove(targetIndex(v));
    },
    [dy, targetIndex]
  );

  /**
   * 이 손짓이 무엇인지 — 아직 모름 / 꾹 눌러 대기 / 끌어 옮기는 중 / 밀어 지우는 중.
   * ref로 두는 이유는 리스폰더 콜백이 한 번만 만들어지기 때문이다(규칙 1).
   */
  const mode = useRef<'idle' | 'armed' | 'dragging'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useLayoutEffect(() => clearTimer, [clearTimer]);

  /** 끌던 것을 내려놓는다 — 어느 경로로 끝나든 여기를 지난다 */
  const drop = useCallback(
    (gdy: number) => {
      const to = targetIndex(gdy);
      // 손을 뗀 자리에서 도착 칸까지 부드럽게 내려앉힌 뒤에 순서를 확정한다.
      // 확정과 동시에 이동값을 0으로 되돌려야 새 자리에서 다시 튀지 않는다.
      const rest = (to - live.current.index) * ROW_H;
      Animated.spring(dy, { toValue: rest, useNativeDriver: true, speed: 16, bounciness: 4 }).start(
        () => live.current.onDragEnd(live.current.index, to)
      );
    },
    [dy, targetIndex]
  );

  const rowPan = useMemo(
    () =>
      PanResponder.create({
        // 손이 닿는 순간 — 시계만 걸고 리스폰더는 넘기지 않는다(규칙 3)
        onStartShouldSetPanResponderCapture: () => {
          mode.current = 'idle';
          clearTimer();
          // 하나뿐이거나 굳은 행이면 옮길 자리가 없다
          if (live.current.count - live.current.floor > 1 && !live.current.locked) {
            timer.current = setTimeout(() => {
              mode.current = 'armed';
              selectionTick();
              lastGdy.current = 0;
              // 목록이 흐르면 그만큼 행을 따라 옮겨 손가락 밑에 붙여 둔다
              live.current.autoScroll?.begin((shift) => apply(lastGdy.current + shift));
              live.current.onDragStart(live.current.index);
            }, LONG_PRESS_MS);
          }
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          // 집어 든 뒤라면 넘겨받는다
          if (mode.current === 'armed') {
            mode.current = 'dragging';
            return true;
          }
          // 그 전에 움직였다면 스크롤하려는 손이다 — 길게 누르기를 접고 비켜준다
          if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) clearTimer();
          return false;
        },
        // 끌고 있는 동안에는 스크롤뷰에 돌려주지 않는다
        onPanResponderTerminationRequest: () => mode.current !== 'dragging',
        onPanResponderMove: (e, g) => {
          if (mode.current !== 'dragging') return;
          lastGdy.current = g.dy;
          // 화면 좌표라야 스크롤뷰의 위·아래 끝과 견줄 수 있다
          live.current.autoScroll?.track(e.nativeEvent.pageY);
          apply(g.dy + (live.current.autoScroll?.delta() ?? 0));
        },
        onPanResponderRelease: (_e, g) => {
          clearTimer();
          const shift = live.current.autoScroll?.delta() ?? 0;
          live.current.autoScroll?.end();
          if (mode.current !== 'dragging') {
            mode.current = 'idle';
            return;
          }
          mode.current = 'idle';
          drop(g.dy + shift);
        },
        onPanResponderTerminate: () => {
          clearTimer();
          live.current.autoScroll?.end();
          if (mode.current === 'dragging') {
            reset(dy);
            live.current.onDragEnd(live.current.index, live.current.index);
          }
          mode.current = 'idle';
        },
      }),
    [dy, apply, clearTimer, drop, reset]
  );

  /**
   * 꾹 눌러 집어 들었는데 움직이지 않고 그대로 뗀 경우.
   * 그때는 리스폰더를 넘겨받은 적이 없어 위의 Release가 오지 않는다 — 여기서 내려놓는다.
   */
  const cancelIfArmed = useCallback(() => {
    clearTimer();
    if (mode.current !== 'armed') return;
    mode.current = 'idle';
    live.current.autoScroll?.end();
    live.current.onDragEnd(live.current.index, live.current.index);
  }, [clearTimer]);

  return (
    <Animated.View
      style={[
        styles.rowWrap,
        {
          top: index * ROW_H,
          zIndex: isDragged ? 10 : 1,
          transform: [{ translateY: shiftY }, { scale: liftScale }],
        },
      ]}
      {...rowPan.panHandlers}
    >
      <View style={styles.row}>
        {/* 집어 든 표시 — 절대 배치라 행의 폭·여백을 건드리지 않는다 */}
        {isDragged && <View style={styles.dragHighlight} pointerEvents="none" />}

        <Pressable
          style={[styles.rowText, props.locked && styles.lockedRow]}
          onPress={props.onPress ? () => live.current.onPress?.() : undefined}
          onPressOut={cancelIfArmed}
          accessibilityRole={props.onPress ? 'button' : 'text'}
          accessibilityLabel={
            props.onPress ? t('edit.a11yEditBlock', { name: block.name }) : block.name
          }
          accessibilityHint={
            count > 1 && !props.locked ? t('edit.a11yReorder', { name: block.name }) : undefined
          }
        >
          <Text style={styles.name}>{block.name}</Text>
          <Text style={[styles.summary, TABULAR]}>
            {blockSummary(block.workSec, block.restSec, block.sets)}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowWrap: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, paddingVertical: 8 },
  /** 굳은 행 — 못 만진다는 것이 손대기 전에 보여야 한다 */
  lockedRow: { opacity: 0.38 },
  /**
   * 집어 든 행은 목록에서 **떠오른 카드**가 된다.
   *
   * 예전에는 살짝 밝은 반투명 겹이었다. 그런데 행이 불투명해진 뒤로는(스와이프 때
   * 뒤의 "삭제"를 가려야 한다) 끌고 가는 행이 지나가는 옆 행을 통째로 덮어버려,
   * 덮인 자리가 빈칸처럼 보였다. 덮는 것 자체는 맞다 — 다만 덮는 쪽이 카드로
   * 보여야 "위에 얹혔다"로 읽힌다. 배경을 한 단계 밝게, 그림자를 아래로 깐다.
   */
  dragHighlight: {
    ...ABS,
    left: -10,
    right: -10,
    top: 2,
    bottom: 2,
    borderRadius: 14,
    backgroundColor: C.surface,
    ...E2,
  },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  summary: { marginTop: 5, fontSize: 14, lineHeight: 19, color: C.textSecondary },
});
