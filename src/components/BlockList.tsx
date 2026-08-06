/**
 * 종목 목록 (핸드오프 5.2)
 * 탭하면 종목 편집 시트, 오른쪽 손잡이를 끌면 순서 변경, 왼쪽으로 스와이프하면 삭제.
 *
 * 제스처를 다루는 규칙 세 가지 — 셋 다 지켜야 드래그가 제대로 걸린다.
 *
 * 1. **팬 리스폰더는 한 번만 만든다.** 드래그 중에는 매 프레임 부모가 리렌더되는데,
 *    그때 PanResponder를 새로 만들면 제스처 누적값(gestureState)이 0부터 다시
 *    시작해 행이 한 칸만 움직이고 멈춘다. 콜백은 ref로 최신 것을 읽는다.
 * 2. **손잡이는 터치가 닿는 순간 잡는다**(onStartShouldSetPanResponder).
 *    스크롤뷰와 협상할 여지를 남기지 않는다.
 * 3. **행 스와이프는 캡처 단계로 잡는다.** 안쪽 Pressable이 이미 리스폰더를
 *    가진 뒤라 버블 단계(onMoveShouldSetPanResponder)로는 넘겨받지 못한다.
 */
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { selectionTick } from '../feedback';
import { blockSummary } from '../engine/labels';
import { t } from '../i18n';
import { ABS, C, TABULAR } from '../theme';
import type { Block } from '../types';

export const ROW_H = 62;
const DELETE_THRESHOLD = 96;

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
  const [swiping, setSwiping] = useState(false);

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
  useLayoutEffect(() => {
    dy.setValue(0);
  }, [index, dy]);

  const targetIndex = useCallback((gdy: number) => {
    const { index: i, count: n } = live.current;
    return Math.max(0, Math.min(n - 1, i + Math.round(gdy / ROW_H)));
  }, []);

  /** 손잡이 — 닿는 순간 잡고, 놓을 때까지 놓지 않는다 */
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // 한 번 잡으면 스크롤뷰에 돌려주지 않는다
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          selectionTick();
          live.current.onDragStart(live.current.index);
        },
        onPanResponderMove: (_e, g) => {
          dy.setValue(g.dy);
          live.current.onDragMove(targetIndex(g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          const to = targetIndex(g.dy);
          // 손을 뗀 자리에서 도착 칸까지 부드럽게 내려앉힌 뒤에 순서를 확정한다.
          // 확정과 동시에 이동값을 0으로 되돌려야 새 자리에서 다시 튀지 않는다.
          const rest = (to - live.current.index) * ROW_H;
          Animated.spring(dy, {
            toValue: rest,
            useNativeDriver: true,
            speed: 16,
            bounciness: 4,
          }).start(() => live.current.onDragEnd(live.current.index, to));
        },
        onPanResponderTerminate: () => {
          dy.setValue(0);
          live.current.onDragEnd(live.current.index, live.current.index);
        },
      }),
    [dy, targetIndex]
  );

  /** 행 전체 — 가로로 밀면 삭제 */
  const swipePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => {
          const x = Math.min(0, g.dx);
          if (x < -4) setSwiping(true);
          tx.setValue(x);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -DELETE_THRESHOLD) {
            Animated.timing(tx, { toValue: -600, duration: 160, useNativeDriver: true }).start(() =>
              live.current.onDelete()
            );
          } else {
            Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(() =>
              setSwiping(false)
            );
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start(() => setSwiping(false));
        },
      }),
    [tx]
  );

  return (
    <Animated.View
      style={[
        styles.rowWrap,
        {
          top: index * ROW_H,
          zIndex: isDragged ? 10 : 1,
          transform: [{ translateX: tx }, { translateY: isDragged ? dy : slide }],
        },
      ]}
      {...swipePan.panHandlers}
    >
      {/* 스와이프하는 동안에만 뒤에서 드러나는 삭제 표시 */}
      {swiping && (
        <View style={styles.deleteBg} pointerEvents="none">
          <Text style={styles.deleteText}>{t('common.delete')}</Text>
        </View>
      )}

      <View style={styles.row}>
        {/* 집어 든 표시 — 절대 배치라 행의 폭·여백을 건드리지 않는다 */}
        {isDragged && <View style={styles.dragHighlight} pointerEvents="none" />}
        <Pressable
          style={styles.rowText}
          onPress={() => live.current.onPress()}
          accessibilityRole="button"
          accessibilityLabel={t('edit.a11yEditBlock', { name: block.name })}
        >
          <Text style={styles.name}>{block.name}</Text>
          <Text style={[styles.summary, TABULAR]}>
            {blockSummary(block.workSec, block.restSec, block.sets)}
          </Text>
        </Pressable>

        {count > 1 && (
          <View
            style={styles.handle}
            accessibilityLabel={t('edit.a11yReorder', { name: block.name })}
            {...handlePan.panHandlers}
          >
            <View style={styles.grip}>
              <View style={styles.gripLine} />
              <View style={styles.gripLine} />
              <View style={styles.gripLine} />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowWrap: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, paddingVertical: 8 },
  dragHighlight: {
    ...ABS,
    left: -10,
    right: -10,
    top: 2,
    bottom: 2,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  deleteBg: {
    ...ABS,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 6,
  },
  deleteText: { color: C.danger, fontSize: 15, fontWeight: '700' },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  summary: { marginTop: 5, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  /** 44pt 터치 영역 — 손잡이는 잡기 쉬워야 한다 */
  handle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 20, gap: 4 },
  gripLine: { height: 2, borderRadius: 1, backgroundColor: C.textTertiary },
});
