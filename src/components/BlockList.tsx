/**
 * 종목 목록 (핸드오프 5.2)
 * 탭하면 종목 편집 시트, 꾹 누르면 순서 변경, 왼쪽으로 밀면 삭제.
 *
 * 손잡이 아이콘은 없앴다. 손잡이가 행 한쪽에 있으면 왼쪽으로 미는 손이 늘 거기서
 * 출발해, 지우려던 것이 순서 바꾸기로 새 버린다. 두 동작을 위치가 아니라 **시간**으로
 * 가른다 — 바로 움직이면 밀기, 머물렀다 움직이면 끌기.
 *
 * 제스처를 다루는 규칙 세 가지 — 셋 다 지켜야 제대로 걸린다.
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
import type { Block } from '../types';

export const ROW_H = 62;
/**
 * 행 너비의 이만큼을 끌어야 지운다.
 *
 * 고정된 거리(72pt)에 튕기는 속도까지 봐주던 때에는 살짝 스친 손짓에도 종목이 사라졌다.
 * 지우는 일은 되돌릴 수 없으니 확실히 끌었을 때만 받는다 — 속도로 질러가는 길도 없앴다.
 */
const DELETE_RATIO = 0.5;
/** 이만큼 머물렀다 움직이면 순서를 옮기려는 손이다 */
const LONG_PRESS_MS = 280;

type Props = {
  blocks: Block[];
  onPress: (block: Block) => void;
  onReorder: (next: Block[]) => void;
  onDelete: (id: string) => void;
  /** 끌고 있는 동안 부모 스크롤을 멈추기 위한 신호 */
  onDragActive?: (active: boolean) => void;
};

export function BlockList({ blocks, onPress, onReorder, onDelete, onDragActive }: Props) {
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
          dragFrom={dragFrom}
          dragTo={dragTo}
          onPress={() => onPress(b)}
          onDelete={() => onDelete(b.id)}
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
  dragFrom: number | null;
  dragTo: number | null;
  onPress: () => void;
  onDelete: () => void;
  onDragStart: (from: number) => void;
  onDragMove: (to: number) => void;
  onDragEnd: (from: number, to: number) => void;
};

function Row(props: RowProps) {
  const { index, block, count, dragFrom, dragTo } = props;

  const tx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  /** 비켜서는 행의 이동 — 값이 튀지 않고 흘러가야 한다 */
  const slide = useRef(new Animated.Value(0)).current;
  /** 집어 들렸는지 — 0이면 목록에 누워 있고 1이면 떠 있다 */
  const lift = useRef(new Animated.Value(0)).current;
  /** 지우는 데 필요한 거리를 여기서 잰다 — 기기 폭에 따라 달라진다 */
  const rowWidth = useRef(0);

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

  /**
   * 삭제 표시는 행 뒤에 가려져 있다가 비켜준 만큼 드러난다. 그런데 조금만 밀면
   * 글자가 중간에서 잘려 보인다 — 글자 폭만큼 열린 뒤에야 또렷해지도록 겹쳐 띄운다.
   */
  const deleteOpacity = tx.interpolate({
    inputRange: [-56, -18],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  /** 리스폰더를 한 번만 만들기 위해, 매 렌더 바뀌는 값들은 ref로 넘긴다 */
  const live = useRef(props);
  live.current = props;

  const isDragged = dragFrom === index;

  /** 드래그 중인 행이 비켜간 자리만큼 다른 행을 밀어둔다 */
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
      slide.setValue(0);
      return;
    }
    Animated.spring(slide, {
      toValue: shift,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [shift, dragFrom, slide]);

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

  useLayoutEffect(() => {
    dy.setValue(0);
  }, [index, dy]);

  const targetIndex = useCallback((gdy: number) => {
    const { index: i, count: n } = live.current;
    return Math.max(0, Math.min(n - 1, i + Math.round(gdy / ROW_H)));
  }, []);

  /**
   * 이 손짓이 무엇인지 — 아직 모름 / 꾹 눌러 대기 / 끌어 옮기는 중 / 밀어 지우는 중.
   * ref로 두는 이유는 리스폰더 콜백이 한 번만 만들어지기 때문이다(규칙 1).
   */
  const mode = useRef<'idle' | 'armed' | 'dragging' | 'swiping' | 'blocked'>('idle');
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
          // 하나뿐이면 옮길 자리도 없다
          if (live.current.count > 1) {
            timer.current = setTimeout(() => {
              mode.current = 'armed';
              selectionTick();
              live.current.onDragStart(live.current.index);
            }, LONG_PRESS_MS);
          }
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          /**
           * 마지막 하나는 지울 수 없다(루틴에는 종목이 최소 하나 있어야 한다).
           * 그럴 때는 아예 밀리지 않게 둔다 — 붉은 자리와 "삭제"를 보여주고서
           * 지우지 않으면, 앱이 약속을 어긴 것처럼 보인다.
           */
          const canDelete = live.current.count > 1;
          const sidewaysRaw = Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
          const sideways = canDelete && sidewaysRaw;

          // 지울 수 없는데 옆으로 밀었다면, 손짓을 여기서 삼킨다.
          // 그냥 두면 Pressable이 탭으로 받아 편집 시트가 열린다 — 민 적 없는 사람처럼.
          if (sidewaysRaw && !canDelete) {
            clearTimer();
            mode.current = 'blocked';
            return true;
          }

          if (mode.current === 'armed') {
            // 집어 들었더라도 손이 옆으로 가면 지우려는 것이다 — 도로 내려놓는다.
            // 시간으로만 가르면 손을 살짝 얹었다 미는 사람은 늘 순서 바꾸기에 걸린다.
            if (sideways) {
              live.current.onDragEnd(live.current.index, live.current.index);
              mode.current = 'swiping';
            } else {
              mode.current = 'dragging';
            }
            return true;
          }

          if (sideways) {
            clearTimer();
            mode.current = 'swiping';
            return true;
          }
          // 그 밖의 움직임(세로 스크롤 등)이면 길게 누르기만 접고 넘기지 않는다
          if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) clearTimer();
          return false;
        },
        // 끌고 있는 동안에는 스크롤뷰에 돌려주지 않는다
        onPanResponderTerminationRequest: () => mode.current !== 'dragging',
        onPanResponderMove: (_e, g) => {
          if (mode.current === 'blocked') return;
          if (mode.current === 'dragging') {
            dy.setValue(g.dy);
            live.current.onDragMove(targetIndex(g.dy));
          } else {
            tx.setValue(Math.min(0, g.dx));
          }
        },
        onPanResponderRelease: (_e, g) => {
          clearTimer();
          if (mode.current === 'blocked') {
            mode.current = 'idle';
            return;
          }
          if (mode.current === 'dragging') {
            mode.current = 'idle';
            drop(g.dy);
            return;
          }
          mode.current = 'idle';
          if (-g.dx >= rowWidth.current * DELETE_RATIO) {
            Animated.timing(tx, { toValue: -600, duration: 160, useNativeDriver: true }).start(() => {
              live.current.onDelete();
              // 지워졌다면 이 행은 사라졌고, 거절당했다면 화면 밖에 남는다 — 되돌려 놓는다
              tx.setValue(0);
            });
          } else {
            Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => {
          clearTimer();
          if (mode.current === 'dragging') {
            dy.setValue(0);
            live.current.onDragEnd(live.current.index, live.current.index);
          }
          mode.current = 'idle';
          Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dy, tx, targetIndex, clearTimer, drop]
  );

  /**
   * 꾹 눌러 집어 들었는데 움직이지 않고 그대로 뗀 경우.
   * 그때는 리스폰더를 넘겨받은 적이 없어 위의 Release가 오지 않는다 — 여기서 내려놓는다.
   */
  const cancelIfArmed = useCallback(() => {
    clearTimer();
    if (mode.current !== 'armed') return;
    mode.current = 'idle';
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
      onLayout={(e) => {
        rowWidth.current = e.nativeEvent.layout.width;
      }}
      {...rowPan.panHandlers}
    >
      {/* 행 뒤에서 기다리는 삭제 표시 — 행이 비켜준 만큼만 드러난다 */}
      <Animated.View style={[styles.deleteBg, { opacity: deleteOpacity }]} pointerEvents="none">
        <Text style={styles.deleteText}>{t('common.delete')}</Text>
      </Animated.View>

      {/*
        가로로 미끄러지는 겹은 따로 둔다. 바깥 겹까지 함께 밀면 뒤에 있어야 할
        삭제 표시가 행을 따라다녀 손잡이 아이콘과 겹친다.
        배경도 불투명해야 한다 — 비쳐 보이면 가리는 의미가 없다.
      */}
      <Animated.View style={[styles.slider, { transform: [{ translateX: tx }] }]}>
        <View style={styles.row}>
          {/* 집어 든 표시 — 절대 배치라 행의 폭·여백을 건드리지 않는다 */}
          {isDragged && <View style={styles.dragHighlight} pointerEvents="none" />}

          <Pressable
            style={styles.rowText}
            onPress={() => live.current.onPress()}
            onPressOut={cancelIfArmed}
            accessibilityRole="button"
            accessibilityLabel={t('edit.a11yEditBlock', { name: block.name })}
            accessibilityHint={count > 1 ? t('edit.a11yReorder', { name: block.name }) : undefined}
          >
            <Text style={styles.name}>{block.name}</Text>
            <Text style={[styles.summary, TABULAR]}>
              {blockSummary(block.workSec, block.restSec, block.sets)}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowWrap: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  /** 가로로 미끄러지는 겹 — 배경색은 화면 바탕과 같아서 보이지 않는다 */
  slider: { flex: 1, backgroundColor: C.bgPlain },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, paddingVertical: 8 },
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
  /** 행이 비켜준 만큼만 보이는 붉은 자리 — 무엇을 하려는 중인지 손이 알아야 한다 */
  deleteBg: {
    ...ABS,
    top: 3,
    bottom: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 16,
    borderRadius: 12,
    backgroundColor: C.dangerBg,
  },
  deleteText: { color: C.danger, fontSize: 15, fontWeight: '700' },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  summary: { marginTop: 5, fontSize: 14, lineHeight: 19, color: C.textSecondary },
});
