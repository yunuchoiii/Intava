/**
 * 휠 피커 (핸드오프 5.5)
 *
 * − / ＋ 스테퍼는 쓰지 않는다 — 90초·3분 같은 값에서 수십 번 눌러야 한다.
 * 높이 176, 중앙 선택 밴드 52, 초 단위 스텝 1초 · 분 단위 스텝 1분.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
  /** 스크롤 위치 — 칸마다 가운데와의 거리에 맞춰 크기 · 진하기가 이어서 바뀐다(네이티브에서) */
  const scrollY = useRef(new Animated.Value(index * ITEM_H)).current;
  const dragging = useRef(false);
  /** 우리가 건 스크롤이 도는 동안에는 외부 값 변경에 다시 반응하지 않는다 */
  const programmatic = useRef(false);
  /**
   * 손을 뗀 뒤 관성으로 구르는 중. 손을 떼는 순간(onScrollEndDrag)에 값을 확정하면, 빠르게 돌렸을 때
   * 휠이 더 굴러간 자리에서 그 값으로 다시 끌려 올라갔다(1초 간격 60칸, 실기기 영상). 관성이 이어지면
   * 멈출 때(onMomentumScrollEnd) 한 번만 확정한다.
   */
  const momentum = useRef(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 처음 한 번, 지금 값이 가운데 오도록 앉힌다.
   *
   * 마운트 직후의 scrollTo는 안드로이드에서 그냥 씹힌다 — 아직 안쪽 내용의
   * 크기가 정해지지 않아 스크롤할 곳이 없기 때문이다. 그래서 내용 크기가
   * 처음 잡히는 순간(onContentSizeChange)에도 한 번 더 앉힌다.
   */
  const seated = useRef(false);
  const seat = useCallback((to: number) => {
    ref.current?.scrollTo({ y: to * ITEM_H, animated: false });
  }, []);

  useEffect(() => {
    seat(index);
    setActive(index);
    // 최초 배치에서만 맞춘다 — 스크롤 중 외부 값 변경으로 튀지 않게
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dragging.current || momentum.current || programmatic.current || index === active) return;
    ref.current?.scrollTo({ y: index * ITEM_H, animated: true });
    setActive(index);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const onActive = useCallback(
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
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: onActive,
      }),
    [scrollY, onActive]
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

  const commitAt = useCallback(
    (y: number) => {
      dragging.current = false;
      momentum.current = false;
      programmatic.current = false;
      const i = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      setActive(clamped);
      onIndex(clamped);
    },
    [items.length, onIndex]
  );

  /** 손을 뗐다 — 바로 관성이 시작되지 않으면(천천히 놓았다) 그 자리로 확정한다 */
  const onEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      dragging.current = false;
      const y = e.nativeEvent.contentOffset.y;
      if (endTimer.current) clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => {
        endTimer.current = null;
        if (!momentum.current) commitAt(y);
      }, 80);
    },
    [commitAt]
  );

  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    []
  );

  return (
    <Animated.ScrollView
      ref={ref}
      style={{ width, height: H }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      /*
        관성 — 'fast'(0.99)는 세게 돌려도 12칸쯤에서 멈춰 1초 간격 60칸을 오가기 답답했다(사용자 피드백).
        0.994는 굴러가는 거리가 약 1.7배(20칸쯤). 'normal'(0.998)은 너무 멀리 가 원하는 값을 지나친다
      */
      decelerationRate={0.994}
      scrollEventThrottle={16}
      /*
        안드로이드는 이것이 없으면 휠이 아예 돌지 않는다. 이 휠은 편집 화면의
        세로 스크롤 안에 들어 있는데, 켜주지 않으면 바깥 스크롤이 손가락을
        통째로 가져가 안쪽에는 한 픽셀도 오지 않는다. iOS는 원래 안쪽이 먼저다.
      */
      nestedScrollEnabled
      onScroll={onScroll}
      onScrollBeginDrag={() => {
        dragging.current = true;
      }}
      onMomentumScrollBegin={() => {
        momentum.current = true;
        if (endTimer.current) clearTimeout(endTimer.current);
        endTimer.current = null;
      }}
      onMomentumScrollEnd={(e) => commitAt(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={onEndDrag}
      onContentSizeChange={(_w, h) => {
        if (seated.current || h <= 0) return;
        seated.current = true;
        seat(index);
      }}
      contentContainerStyle={{ paddingVertical: PAD }}
    >
      {items.map((label, i) => {
        /*
          가운데에 가까울수록 크고 진하게 — 칸이 바뀌는 순간 한 번에 바뀌던 것을 스크롤을 따라 이어서
          바꾼다(사용자 요청). 글자 크기는 애니메이션이 안 돼 가장 큰 24로 그리고 배율로 줄인다
          (24 → 19 → 17). 굵기도 중간값이 없어 하나로 둔다 — 차이는 진하기가 맡는다.
        */
        const at = i * ITEM_H;
        const range = [at - 2 * ITEM_H, at - ITEM_H, at, at + ITEM_H, at + 2 * ITEM_H];
        const scale = scrollY.interpolate({
          inputRange: range,
          outputRange: [17 / 24, 19 / 24, 1, 19 / 24, 17 / 24],
          extrapolate: 'clamp',
        });
        const opacity = scrollY.interpolate({
          inputRange: range,
          outputRange: [0.12, 0.22, 1, 0.22, 0.12],
          extrapolate: 'clamp',
        });
        return (
          <Pressable
            key={label + i}
            onPress={() => pick(i)}
            style={{ height: ITEM_H, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Animated.Text
              style={[
                TABULAR,
                {
                  fontSize: 24,
                  fontWeight: '700',
                  color: C.textPrimary,
                  opacity,
                  textAlign: align,
                  // 줄어들 때 정렬한 쪽 끝을 붙잡는다 — 가운데로 줄면 분·초 사이가 벌어진다
                  transformOrigin: align === 'right' ? 'right center' : align === 'left' ? 'left center' : 'center',
                  transform: [{ scale }],
                },
              ]}
            >
              {label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </Animated.ScrollView>
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
/** 초 칸 간격 — 5초였는데 7초 · 12초 같은 값을 못 골랐다(사용자 피드백 2026-11-05) */
const SEC_STEP = 1;

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
