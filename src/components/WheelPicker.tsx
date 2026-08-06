/**
 * 휠 피커 (핸드오프 5.5)
 *
 * − / ＋ 스테퍼는 쓰지 않는다 — 90초·3분 같은 값에서 수십 번 눌러야 한다.
 * 높이 176, 중앙 선택 밴드 52, 초 단위 스텝 5초 · 분 단위 스텝 1분.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
} from 'react-native';
import { selectionTick } from '../feedback';
import { t } from '../i18n';
import { C, TABULAR } from '../theme';

const H = 176;
const ITEM_H = 44;
const PAD = (H - ITEM_H) / 2;
const BAND = 52;

type ColumnProps = {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  align: 'right' | 'left' | 'center';
  width: number;
};

function Column({ items, index, onIndex, align, width }: ColumnProps) {
  const ref = useRef<ScrollView>(null);
  const [active, setActive] = useState(index);
  const dragging = useRef(false);
  /** 우리가 건 스크롤이 도는 동안에는 외부 값 변경에 다시 반응하지 않는다 */
  const programmatic = useRef(false);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    setActive(index);
    // 최초 배치에서만 맞춘다 — 스크롤 중 외부 값 변경으로 튀지 않게
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dragging.current || programmatic.current || index === active) return;
    ref.current?.scrollTo({ y: index * ITEM_H, animated: true });
    setActive(index);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      if (clamped !== active) {
        setActive(clamped);
        // 한 칸 지날 때마다 한 번 — 손끝에 눈금이 지나가는 느낌을 만든다
        selectionTick();
      }
    },
    [active, items.length]
  );

  /**
   * 위아래 항목을 탭하면 그 항목이 중앙으로 온다.
   *
   * 여기서 active를 직접 바꾸면 안 된다 — 제자리에 있는 항목이 먼저 선택 스타일이
   * 됐다가, 스크롤이 시작되며 중앙 항목에 자리를 내주고, 도착해서 다시 선택되는
   * 깜빡임이 생긴다. 표시는 스크롤(onScroll)이 데려오게 두고 값만 확정한다.
   */
  const pick = useCallback(
    (i: number) => {
      if (i === active) return;
      selectionTick();
      programmatic.current = true;
      ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
      onIndex(i);
      // onMomentumScrollEnd가 오지 않는 경우를 대비한 해제
      setTimeout(() => {
        programmatic.current = false;
      }, 500);
    },
    [active, onIndex]
  );

  const commit = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      dragging.current = false;
      programmatic.current = false;
      const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      setActive(clamped);
      onIndex(clamped);
    },
    [items.length, onIndex]
  );

  return (
    <ScrollView
      ref={ref}
      style={{ width, height: H }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollBeginDrag={() => {
        dragging.current = true;
      }}
      onMomentumScrollEnd={commit}
      onScrollEndDrag={commit}
      contentContainerStyle={{ paddingVertical: PAD }}
    >
      {items.map((label, i) => {
        const d = Math.abs(i - active);
        const size = d === 0 ? 24 : d === 1 ? 19 : 17;
        const opacity = d === 0 ? 1 : d === 1 ? 0.22 : 0.12;
        return (
          <Pressable
            key={label + i}
            onPress={() => pick(i)}
            style={{ height: ITEM_H, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text
              style={[
                TABULAR,
                {
                  fontSize: size,
                  fontWeight: d === 0 ? '700' : '600',
                  color: C.textPrimary,
                  opacity,
                  textAlign: align,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Band() {
  return (
    <View pointerEvents="none" style={styles.band}>
      <View style={styles.bandInner} />
    </View>
  );
}

const MAX_MIN = 30;
const SEC_STEP = 5;

/** 분·초 2열 피커 */
export function TimeWheel({
  value,
  onChange,
  allowZero = true,
}: {
  value: number;
  onChange: (sec: number) => void;
  allowZero?: boolean;
}) {
  const minutes = useMemo(
    () => Array.from({ length: MAX_MIN + 1 }, (_, i) => t('duration.min', { m: i })),
    []
  );
  const seconds = useMemo(
    () => Array.from({ length: 60 / SEC_STEP }, (_, i) => t('duration.sec', { s: i * SEC_STEP })),
    []
  );

  const m = Math.min(MAX_MIN, Math.floor(value / 60));
  const s = Math.round((value % 60) / SEC_STEP) % (60 / SEC_STEP);

  const emit = (mm: number, ss: number) => {
    const next = mm * 60 + ss * SEC_STEP;
    onChange(!allowZero && next === 0 ? SEC_STEP : next);
  };

  return (
    <View style={styles.wrap}>
      <Band />
      <View style={styles.row}>
        <Column
          items={minutes}
          index={m}
          onIndex={(i) => emit(i, s)}
          align="right"
          width={96}
        />
        <View style={{ width: 30 }} />
        <Column items={seconds} index={s} onIndex={(i) => emit(m, i)} align="left" width={96} />
      </View>
    </View>
  );
}

/** 세트·라운드 1열(정수) 피커 */
export function CountWheel({
  value,
  onChange,
  min = 1,
  max = 30,
  unit = '',
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const items = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => `${i + min}${unit}`),
    [min, max, unit]
  );
  const index = Math.max(0, Math.min(items.length - 1, value - min));
  return (
    <View style={styles.wrap}>
      <Band />
      <View style={styles.row}>
        <Column
          items={items}
          index={index}
          onIndex={(i) => onChange(i + min)}
          align="center"
          width={130}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.divider,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: BAND,
    marginTop: -BAND / 2,
    paddingHorizontal: 24,
  },
  bandInner: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
});
