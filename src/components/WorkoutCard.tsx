/**
 * 운동 완료 카드 — 완료 화면과 공유 이미지가 같은 조각을 쓴다(시안 「스토리 공유 카드」 2a–2d).
 *
 * 1순위는 오늘 한 운동을 한눈에 읽는 것이다. 링은 그날 전체의 운동/휴식 비율이고,
 * 종목 줄마다 같은 문법의 막대가 붙는다 — 막대 길이는 종목에서 보낸 시간, 그 안의
 * 빨간 몫이 운동이다. 로고의 링과 같은 모양이라 브랜드가 곧 기록이 된다.
 *
 * 공유 이미지(ShareImage)는 360×640으로 그려 1080×1920(인스타 스토리)으로 찍는다.
 * 스크롤이 없으므로 종목은 일곱 줄까지만 두고 나머지는 「외 N개 종목」으로 묶는다.
 * 아래 112pt(이미지 기준)는 인스타 답장창 자리라 비워 둔다.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { clock } from '../engine/labels';
import { t } from '../i18n';
import { TABULAR } from '../theme';
import type { RecordBlock, WorkoutRecord } from '../types';

export const CARD = {
  bg: '#0A0A0D',
  work: '#D32F3E',
  rest: '#12897C',
  text: '#F7F7F8',
  sub: '#9A9EA6',
  legend: '#B5B8BE',
  meta: '#8C9098',
  line: 'rgba(255,255,255,0.06)',
  panel: 'rgba(255,255,255,0.05)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

/** 숫자 글꼴 — app.json의 expo-font가 묶어 넣는다(iOS는 PostScript 이름으로 찾는다) */
export const NUM_BOLD = 'LeagueSpartan-Bold';
export const NUM_SEMI = 'LeagueSpartan-SemiBold';

/** 이미지에 넣는 종목 줄 수 — 넘으면 「외 N개 종목」 */
export const SHARE_MAX_ROWS = 7;

// ---- 바탕 ------------------------------------------------------------------

/**
 * 오른쪽 위에서 빨강, 왼쪽 가운데에서 청록이 번지는 어두운 바탕.
 * CSS radial-gradient(가로% 세로% at x y)를 objectBoundingBox 단위로 옮겼다.
 */
export function Backdrop({
  id,
  bottomGlow = true,
  width = '100%',
  height = '100%',
}: {
  id: string;
  bottomGlow?: boolean;
  /** 찍을 이미지에서는 숫자로 준다 — 100%로 두면 찍힌 그림에서 오른쪽·아래가 비었다 */
  width?: number | string;
  height?: number | string;
}) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id={`${id}r`} cx="1" cy="-0.04" rx="1.3" ry="0.62">
          <Stop offset="0" stopColor={CARD.work} stopOpacity={0.38} />
          <Stop offset="0.42" stopColor={CARD.work} stopOpacity={0.12} />
          <Stop offset="0.72" stopColor={CARD.work} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}t`} cx="-0.1" cy="0.64" rx="1.4" ry="0.7">
          <Stop offset="0" stopColor={CARD.rest} stopOpacity={0.42} />
          <Stop offset="0.45" stopColor={CARD.rest} stopOpacity={0.14} />
          <Stop offset="0.75" stopColor={CARD.rest} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="0.7" cy="1.08" rx="0.9" ry="0.4">
          <Stop offset="0" stopColor={CARD.rest} stopOpacity={0.25} />
          <Stop offset="0.7" stopColor={CARD.rest} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={CARD.bg} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}r)`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}t)`} />
      {bottomGlow && <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}b)`} />}
    </Svg>
  );
}

// ---- 링 --------------------------------------------------------------------

const VB = 240;
const MID = VB / 2;

/**
 * 두 호 — 청록(휴식)이 12시 조금 뒤에서 출발하고, 이어 빨강(운동)이 돈다.
 * 호 사이에는 둥근 끝 너비만큼의 틈을 둔다(시안의 dasharray를 비율로 풀어 쓴 것).
 */
function arcs(r: number, stroke: number, work: number, total: number) {
  const circ = 2 * Math.PI * r;
  const gap = stroke * 2;
  const rest = Math.max(0, total - work);
  if (total <= 0) return [];
  if (work <= 0 || rest <= 0) {
    return [{ color: work > 0 ? CARD.work : CARD.rest, len: circ - gap, offset: -gap / 2 }];
  }
  const avail = circ - gap * 2;
  const restLen = (avail * rest) / total;
  const workLen = (avail * work) / total;
  return [
    { color: CARD.rest, len: restLen, offset: -gap / 2 },
    { color: CARD.work, len: workLen, offset: -(gap / 2 + restLen + gap) },
  ];
}

export function SplitRing({
  size,
  work,
  total,
  label,
  labelSize,
}: {
  size: number;
  work: number;
  total: number;
  label: string;
  labelSize: number;
}) {
  const r = 100;
  const stroke = 22;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${MID}, ${MID}`}>
          {arcs(r, stroke, work, total).map((a, i) => (
            <Circle
              key={i}
              cx={MID}
              cy={MID}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${a.len} ${circ}`}
              strokeDashoffset={a.offset}
            />
          ))}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.ringLabel, TABULAR, { fontSize: labelSize }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** 로고 — 같은 두 호의 링 + intava. 비율은 고정(브랜드 표식) */
export function Logo({ size, fontSize }: { size: number; fontSize: number }) {
  const r = 94;
  const circ = 2 * Math.PI * r;
  return (
    <View style={styles.logo}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <G rotation={-90} origin={`${MID}, ${MID}`}>
          <Circle cx={MID} cy={MID} r={r} fill="none" stroke={CARD.rest} strokeWidth={32}
            strokeLinecap="round" strokeDasharray={`329.7 ${circ}`} strokeDashoffset={-32} />
          <Circle cx={MID} cy={MID} r={r} fill="none" stroke={CARD.work} strokeWidth={32}
            strokeLinecap="round" strokeDasharray={`132.9 ${circ}`} strokeDashoffset={-425.7} />
        </G>
      </Svg>
      <Text style={[styles.logoText, { fontSize }]}>intava</Text>
    </View>
  );
}

// ---- 글 --------------------------------------------------------------------

const two = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** 완료 화면 머리 오른쪽 — "10월 20일 화 · 08:36–09:35" */
export function cardDateLine(r: WorkoutRecord): string {
  const d = new Date(r.startedAt);
  return t('doneScreen.cardDate', {
    m: d.getMonth() + 1,
    d: d.getDate(),
    w: t('doneScreen.cardWeekdays').split(' ')[d.getDay()],
    from: hm(r.startedAt),
    to: hm(r.endedAt),
  });
}

/** 공유 이미지 머리 — "10.20 TUE · 08:36". 이미지는 언어와 상관없이 같은 꼴로 둔다 */
export function shareDateLine(r: WorkoutRecord): string {
  const d = new Date(r.startedAt);
  const w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  return `${two(d.getMonth() + 1)}.${two(d.getDate())} ${w} · ${hm(r.startedAt)}`;
}

/**
 * 이름 아래 한 줄 — "6종목 · 1라운드 · 30세트".
 *
 * 기록의 구성 문구(shape)는 루틴이면 숫자가 둘("9종목 1라운드"), 타이머면 계획한
 * 세트 하나("8세트")다. 타이머에 해낸 세트를 또 붙이면 "8세트 · 6세트"가 되어
 * 서로 다투므로, 그때는 해낸 세트만 적는다.
 */
export function subtitleLine(r: WorkoutRecord): string {
  const sets = t('count.sets', { count: r.completedSets });
  const nums = r.shape.match(/\d+/g) ?? [];
  return nums.length >= 2 ? `${r.shape} · ${sets}` : sets;
}

// ---- 종목 줄 ----------------------------------------------------------------

/** 종목 안 운동 몫 — 옛 기록(workSec 없음)은 그날 전체의 운동 비율로 대신한다 */
function workShare(b: RecordBlock, r: WorkoutRecord): number {
  if (b.durSec <= 0) return 0;
  if (b.workSec != null) return Math.min(1, b.workSec / b.durSec);
  return r.totalSec > 0 ? Math.min(1, r.workSec / r.totalSec) : 0;
}

/** 막대 — 바탕 위에, 종목 시간만큼의 길이로 운동(빨강)과 휴식(청록)을 잇는다 */
function SplitBar({ ratio, work, height }: { ratio: number; work: number; height: number }) {
  const radius = height / 2 + 0.5;
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: CARD.line }}>
      <View style={{ flexDirection: 'row', height, gap: 2, width: `${Math.max(2, ratio * 100)}%` }}>
        {work > 0 && (
          <View style={{ height, borderRadius: radius, backgroundColor: CARD.work, width: `${work * 100}%` }} />
        )}
        {work < 1 && <View style={{ flex: 1, height, borderRadius: radius, backgroundColor: CARD.rest }} />}
      </View>
    </View>
  );
}

/** 완료 화면의 종목 줄 — 이름·시간 / 막대 / 구성 */
export function BlockLine({ block, record, maxDur }: { block: RecordBlock; record: WorkoutRecord; maxDur: number }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineHead}>
        <Text style={styles.lineName} numberOfLines={1}>
          {block.name}
        </Text>
        <Text style={[styles.lineTime, TABULAR]}>{clock(block.durSec)}</Text>
      </View>
      <SplitBar ratio={maxDur > 0 ? block.durSec / maxDur : 0} work={workShare(block, record)} height={5} />
      <Text style={styles.lineMeta} numberOfLines={1}>
        {block.spec}
      </Text>
    </View>
  );
}

// ---- 공유 이미지 --------------------------------------------------------------

export const SHARE_W = 360;
export const SHARE_H = 640;

/**
 * 공유·저장용 이미지 — 360×640으로 그려 3배로 찍는다(1080×1920).
 * 화면에 보이지 않게 완료 화면 바탕 뒤에 깔아 둔다(찍을 때는 가려져 있어도 된다).
 */
export const ShareImage = React.forwardRef<View, { record: WorkoutRecord; style?: StyleProp<ViewStyle> }>(
  function ShareImage({ record, style }, ref) {
    const blocks = record.blocks;
    const shown = blocks.slice(0, SHARE_MAX_ROWS);
    const rest = blocks.slice(SHARE_MAX_ROWS);
    const maxDur = Math.max(1, ...blocks.map((b) => b.durSec));
    const restTotal = Math.max(0, record.totalSec - record.workSec);
    /** 일곱 줄이 차면 촘촘하게(시안 2d) — 아래 답장창 자리(112pt)를 넘지 않게 */
    const dense = blocks.length >= SHARE_MAX_ROWS;
    return (
      <View ref={ref} collapsable={false} style={[styles.share, style]}>
        <Backdrop id="share" bottomGlow={false} width={SHARE_W} height={SHARE_H} />
        <View style={styles.shareHead}>
          <Logo size={20} fontSize={19} />
          <Text style={[styles.shareDate, TABULAR]}>{shareDateLine(record)}</Text>
        </View>
        <View style={[styles.hero, { marginTop: dense ? 18 : 20, gap: 18 }]}>
          <SplitRing size={dense ? 100 : 128} work={record.workSec} total={record.totalSec}
            label={clock(record.totalSec)} labelSize={dense ? 24 : 30} />
          <View style={styles.heroText}>
            <Text style={[styles.heroName, { fontSize: 21 }]} numberOfLines={2}>
              {record.presetName}
            </Text>
            <Text style={[styles.heroSub, { fontSize: 11.5 }]} numberOfLines={1}>
              {subtitleLine(record)}
            </Text>
            <View style={styles.legend}>
              <Legend color={CARD.work} value={clock(record.workSec)} small />
              <Legend color={CARD.rest} value={clock(restTotal)} small />
            </View>
          </View>
        </View>
        {shown.length > 0 && (
          <View style={[styles.panel, styles.sharePanel, dense && { marginTop: 14 }]}>
            {shown.map((b, i) => (
              <View
                key={`${b.name}${i}`}
                style={[styles.shareLine, dense && { paddingVertical: 5 }, i > 0 && styles.shareRule]}
              >
                <View style={styles.lineHead}>
                  <Text style={[styles.lineName, { fontSize: dense ? 12.5 : 13 }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={[styles.lineTime, TABULAR, { fontSize: dense ? 13.5 : 14 }]}>
                    {clock(b.durSec)}
                  </Text>
                </View>
                <View style={styles.shareBarRow}>
                  <View style={{ flex: 1 }}>
                    <SplitBar ratio={b.durSec / maxDur} work={workShare(b, record)} height={4} />
                  </View>
                  <Text style={styles.shareMeta} numberOfLines={1}>
                    {b.spec}
                  </Text>
                </View>
              </View>
            ))}
            {rest.length > 0 && (
              <View style={[styles.shareMore, styles.shareRule]}>
                <Text style={styles.shareMoreText}>{t('doneScreen.moreBlocks', { count: rest.length })}</Text>
                <Text style={[styles.shareMoreTime, TABULAR]}>
                  {clock(rest.reduce((s, b) => s + b.durSec, 0))}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
);

export function Legend({ color, label, value, small }: { color: string; label?: string; value: string; small?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {!!label && <Text style={styles.legendLabel}>{label}</Text>}
      <Text style={[styles.legendValue, TABULAR, small && { fontSize: 14 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ringLabel: { fontFamily: NUM_BOLD, color: CARD.text, letterSpacing: -1, paddingTop: 3 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoText: { fontFamily: NUM_SEMI, color: CARD.text, letterSpacing: -0.9, paddingTop: 3 },

  hero: { flexDirection: 'row', alignItems: 'center' },
  heroText: { flex: 1, minWidth: 0, gap: 8 },
  heroName: { fontWeight: '800', letterSpacing: -0.8, color: CARD.text },
  heroSub: { color: CARD.sub },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  legendLabel: { fontSize: 11.5, color: CARD.legend },
  legendValue: { fontFamily: NUM_BOLD, fontSize: 15, color: CARD.text, paddingTop: 2 },

  panel: {
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: CARD.panel,
    borderWidth: 1,
    borderColor: CARD.panelBorder,
  },
  line: {
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: CARD.line,
  },
  lineHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  lineName: { flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: '600', color: CARD.text },
  lineTime: { fontFamily: NUM_BOLD, fontSize: 16, color: CARD.text },
  lineMeta: { fontSize: 11.5, color: CARD.meta },

  share: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHARE_W,
    height: SHARE_H,
    overflow: 'hidden',
    backgroundColor: CARD.bg,
    paddingTop: 44,
    paddingHorizontal: 24,
  },
  shareHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareDate: { fontSize: 11, fontWeight: '600', color: CARD.sub },
  sharePanel: { marginTop: 22, paddingHorizontal: 14, borderRadius: 16, overflow: 'hidden' },
  shareLine: { gap: 5, paddingVertical: 8 },
  shareRule: { borderTopWidth: 1, borderTopColor: CARD.line },
  shareBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareMeta: { fontSize: 10, color: CARD.meta },
  shareMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 7 },
  shareMoreText: { fontSize: 12, color: CARD.sub },
  shareMoreTime: { fontFamily: NUM_BOLD, fontSize: 13.5, color: CARD.legend },
});

export const cardStyles = styles;
