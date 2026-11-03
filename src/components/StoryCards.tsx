/**
 * 스토리 공유 카드 — 기본 카드(WorkoutCard의 ShareImage) 옆에 고를 수 있는 네 가지.
 * 시안 「인타바 스토리 공유 카드」 TURN 3 (3a · 3c · 3d · 3e, 2026-11 handoff).
 *
 * 모두 360×640으로 그려 3배로 찍는다(1080×1920). 시안 문서의 px 값도 이 좌표계다.
 * 위아래 여백은 시안 2026-11-03 개정값이다 — 글은 위 68(사진 카드 로고 72), 아래 64부터.
 * 인스타 프로필 줄과 하단 바 바로 안쪽이다. 사진 배경은 끝까지 채운다.
 *
 * 3a·3c는 사진 위에 얹는다. 사진이 없으면 프레임 기본색(#2A2A2E)이 깔린다 — 고르는 화면이
 * 사진 없이는 공유를 막는다.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../i18n';
import { TABULAR } from '../theme';
import type { WorkoutRecord } from '../types';
import { CARD, NUM_BOLD, SHARE_H, SHARE_W } from './WorkoutCard';

/** 3e의 큰 숫자 — app.json의 expo-font가 묶어 넣는다 */
const NUM_EXTRA = 'LeagueSpartan-ExtraBold';

/** 사진 위 색 — 어두운 바탕보다 한 단 밝다 */
const ON_PHOTO = { work: '#E8414F', rest: '#1AA897' };

export type StoryTemplate = 'photoStack' | 'photoStrip' | 'ringHero' | 'typePoster';

// ---- 값 ----------------------------------------------------------------------

/** 1시간 미만 M:SS, 이상 H:MM:SS — 운동·휴식 값에도 같은 규칙 */
export function storyTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const two = (n: number) => String(n).padStart(2, '0');

/** 「10.20 TUE」, 시작 시각을 붙이면 「10.20 TUE · 08:36」 — 시안은 언어와 관계없이 이 꼴이다 */
function storyDate(r: WorkoutRecord, withTime: boolean): string {
  const d = new Date(r.startedAt);
  const day = `${two(d.getMonth() + 1)}.${two(d.getDate())} ${DOW[d.getDay()]}`;
  return withTime ? `${day} · ${two(d.getHours())}:${two(d.getMinutes())}` : day;
}

/** 지나온 라운드 수 — 라운드 휴식을 지난 만큼 + 1 */
function roundsOf(r: WorkoutRecord): number {
  return r.segs.filter((s) => s.phase === 'ROUND_REST').length + 1;
}

function numbers(r: WorkoutRecord) {
  const total = Math.max(0, r.totalSec);
  const work = Math.min(total, Math.max(0, r.workSec));
  const rest = total - work;
  const ratio = total > 0 ? work / total : 0;
  return {
    total,
    work,
    rest,
    ratio,
    long: total >= 3600,
    blocks: r.blocks.length,
    rounds: roundsOf(r),
    sets: r.completedSets,
  };
}

/**
 * 시안처럼 줄 높이를 글자보다 작게(lineHeight .82~.9) 잡으면 iOS가 글자 윗부분을 잘라 먹는다.
 * 줄 높이는 넉넉히 두고 늘어난 만큼 위아래 여백을 음수로 당겨, 차지하는 높이만 시안 값에 맞춘다.
 */
function tight(size: number, lh: number, top = 0) {
  const box = Math.ceil(size * 1.3);
  const pad = (box - lh) / 2;
  return { fontSize: size, lineHeight: box, marginTop: top - pad, marginBottom: -pad };
}

// ---- 조각 --------------------------------------------------------------------

/** 로고 마크 — 링 두 구간. 컬러판과 사진 위 흰색판 */
function Mark({ size, onPhoto }: { size: number; onPhoto?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <G rotation={-90} origin="120, 120">
        <Circle cx={120} cy={120} r={94} fill="none" strokeWidth={32} strokeLinecap="round"
          stroke={onPhoto ? 'rgba(255,255,255,0.55)' : CARD.rest}
          strokeDasharray="329.7 590.6" strokeDashoffset={-32} />
        <Circle cx={120} cy={120} r={94} fill="none" strokeWidth={32} strokeLinecap="round"
          stroke={onPhoto ? '#FFFFFF' : CARD.work}
          strokeDasharray="132.9 590.6" strokeDashoffset={-425.7} />
      </G>
    </Svg>
  );
}

function StoryLogo({ mark, word, gap = 7, onPhoto }: { mark: number; word: number; gap?: number; onPhoto?: boolean }) {
  return (
    <View style={[s.row, { gap }]}>
      <Mark size={mark} onPhoto={onPhoto} />
      {/* 워드마크는 글자 몸이 위로 떠 보여 2~3pt 내려 맞춘다 */}
      <Text style={[s.word, { fontSize: word, lineHeight: word, paddingTop: word * 0.14, letterSpacing: -0.045 * word }]}>
        intava
      </Text>
    </View>
  );
}

/**
 * 진행 링 — 배경 트랙 없이 휴식·운동 두 구간. 12시에서 g/2 띄워 출발한다.
 * round cap이 굵기의 절반씩 튀어나와 실제로 보이는 틈은 g − stroke다.
 */
function StoryRing({
  size, stroke, gap, ratio, restColor, workColor, children,
}: {
  size: number; stroke: number; gap: number; ratio: number;
  restColor: string; workColor: string; children?: React.ReactNode;
}) {
  const C = 2 * Math.PI * 100;
  const work = Math.min(1, Math.max(0, ratio));
  const parts: { color: string; len: number; offset: number }[] = [];
  if (work <= 0 || work >= 1) {
    parts.push({ color: work >= 1 ? workColor : restColor, len: C - gap, offset: -gap / 2 });
  } else {
    const L = C - 2 * gap;
    const restLen = L * (1 - work);
    parts.push({ color: restColor, len: restLen, offset: -gap / 2 });
    parts.push({ color: workColor, len: L * work, offset: -(gap / 2 + restLen + gap) });
  }
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin="120, 120">
          {parts.map((p, i) => (
            <Circle key={i} cx={120} cy={120} r={100} fill="none" stroke={p.color} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={`${p.len} ${C}`} strokeDashoffset={p.offset} />
          ))}
        </G>
      </Svg>
      {children && <View style={[StyleSheet.absoluteFill, s.center]}>{children}</View>}
    </View>
  );
}

/** 운동/휴식 비율 막대 — 두 칸 사이 8pt */
function RatioBar({ ratio, height, work, rest }: { ratio: number; height: number; work: string; rest: string }) {
  const w = Math.min(1, Math.max(0, ratio));
  return (
    <View style={[s.row, { height, gap: w > 0 && w < 1 ? 8 : 0 }]}>
      {w > 0 && <View style={{ flex: w, height, borderRadius: height / 2, backgroundColor: work }} />}
      {w < 1 && <View style={{ flex: 1 - w, height, borderRadius: height / 2, backgroundColor: rest }} />}
    </View>
  );
}

/** CSS radial-gradient(가로 세로 at x y, 색 …) — objectBoundingBox 단위로 옮긴 것 */
type Glow = { cx: number; cy: number; rx: number; ry: number; stops: [number, string, number][] };

function Glows({ id, base, glows }: { id: string; base?: string; glows: Glow[] }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={SHARE_W} height={SHARE_H} pointerEvents="none">
      <Defs>
        {glows.map((g, i) => (
          <RadialGradient key={i} id={`${id}${i}`} cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry}>
            {g.stops.map(([o, c, a], j) => (
              <Stop key={j} offset={o} stopColor={c} stopOpacity={a} />
            ))}
          </RadialGradient>
        ))}
      </Defs>
      {base && <Rect x="0" y="0" width="100%" height="100%" fill={base} />}
      {glows.map((_, i) => (
        <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#${id}${i})`} />
      ))}
    </Svg>
  );
}

function Photo({ uri }: { uri?: string }) {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2A2A2E' }]} />
      {!!uri && <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />}
    </>
  );
}

// ---- 3a 사진 · 우측 하단 숫자 스택 ------------------------------------------

function PhotoStack({ record, photo }: { record: WorkoutRecord; photo?: string }) {
  const n = numbers(record);
  return (
    <>
      <Photo uri={photo} />
      <Glows
        id="sa"
        glows={[
          { cx: 0, cy: 0, rx: 0.7, ry: 0.22, stops: [[0, '#000', 0.35], [0.8, '#000', 0]] },
        ]}
      />
      {/*
        아래는 3c와 같은 세로 그라데이션 — 시안의 오른쪽 아래 둥근 그늘(radial)로는 밝은 사진에서
        숫자가 묻혔다(사용자 지적 2026-11-03)
      */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
        locations={[0.45, 0.88]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', left: 24, top: 72 }}>
        <StoryLogo mark={18} word={18} onPhoto />
      </View>
      <View style={{ position: 'absolute', right: 24, bottom: 64, left: 24, alignItems: 'flex-end' }}>
        <Text style={[s.shadow, s.photoSub]}>{storyDate(record, false)}</Text>
        <Text style={[s.shadow, s.photoName, { marginTop: 8 }]} numberOfLines={1}>
          {record.presetName}
        </Text>
        <View style={[s.row, { gap: 12, marginTop: 6 }]}>
          <StoryRing size={46} stroke={26} gap={60} ratio={n.ratio} restColor="rgba(255,255,255,0.45)" workColor="#FFFFFF" />
          <Text style={[s.shadow, s.num, TABULAR, { ...tight(60, 54, 6), letterSpacing: -3 }]}>
            {storyTime(n.total)}
          </Text>
        </View>
        <View style={[s.row, { gap: 18, marginTop: 16 }]}>
          <PhotoStat value={storyTime(n.work)} label={t('doneScreen.legendWork')} />
          <PhotoStat value={storyTime(n.rest)} label={t('doneScreen.legendRest')} />
          <PhotoStat value={String(n.sets)} label={t('story.sets')} />
        </View>
      </View>
    </>
  );
}

function PhotoStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'flex-end', gap: 3 }}>
      <Text style={[s.shadow, s.num, TABULAR, { fontSize: 24 }]}>{value}</Text>
      <Text style={[s.shadow, s.photoSub]}>{label}</Text>
    </View>
  );
}

// ---- 3c 사진 · 하단 비율 바 스트립 --------------------------------------------

function PhotoStrip({ record, photo }: { record: WorkoutRecord; photo?: string }) {
  const n = numbers(record);
  return (
    <>
      <Photo uri={photo} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
        locations={[0.45, 0.88]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 64 }}>
        <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }]}>
          <View style={{ flexShrink: 1, gap: 9 }}>
            <Text style={[s.shadow, s.photoSub, { fontSize: 12 }]} numberOfLines={1}>
              {record.presetName}
            </Text>
            <Text style={[s.shadow, s.num, TABULAR, { ...tight(52, 47), letterSpacing: -2.6 }]}>
              {storyTime(n.total)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
            <Text style={[s.shadow, s.num, TABULAR, { fontSize: 28 }]}>{n.sets}</Text>
            <Text style={[s.shadow, s.photoSub]}>
              {t('story.setsAnd', { blocks: t('count.blocks', { count: n.blocks }) })}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <RatioBar ratio={n.ratio} height={8} work={ON_PHOTO.work} rest={ON_PHOTO.rest} />
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
          <BarLabel label={t('doneScreen.legendWork')} value={storyTime(n.work)} />
          <BarLabel label={t('doneScreen.legendRest')} value={storyTime(n.rest)} />
        </View>
        <View style={[s.row, s.stripFoot]}>
          <StoryLogo mark={15} word={15} gap={6} onPhoto />
          <Text style={[s.shadow, s.photoSub]}>{storyDate(record, true)}</Text>
        </View>
      </View>
    </>
  );
}

function BarLabel({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.row, { gap: 5, alignItems: 'baseline' }]}>
      <Text style={[s.shadow, s.photoSub, { fontSize: 11, color: 'rgba(255,255,255,0.85)' }]}>{label}</Text>
      <Text style={[s.shadow, s.num, TABULAR, { fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

// ---- 공통 머리(3d · 3e) -------------------------------------------------------

function DarkHead({ record }: { record: WorkoutRecord }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      <StoryLogo mark={20} word={19} />
      <Text style={[s.darkDate, TABULAR]}>{storyDate(record, true)}</Text>
    </View>
  );
}

// ---- 3d 링 히어로 --------------------------------------------------------------

function RingHero({ record }: { record: WorkoutRecord }) {
  const n = numbers(record);
  return (
    <>
      <Glows
        id="sd"
        base={CARD.bg}
        glows={[
          { cx: 0, cy: 0.12, rx: 1.3, ry: 0.62, stops: [[0, CARD.work, 0.38], [0.42, CARD.work, 0.12], [0.72, CARD.work, 0]] },
          { cx: 1.1, cy: 0.86, rx: 1.4, ry: 0.7, stops: [[0, CARD.rest, 0.42], [0.45, CARD.rest, 0.14], [0.75, CARD.rest, 0]] },
        ]}
      />
      <View style={s.darkBody}>
        <DarkHead record={record} />
        <Text style={s.heroName} numberOfLines={1}>{record.presetName}</Text>
        <View style={{ alignItems: 'center', marginTop: 28 }}>
          <StoryRing size={232} stroke={20} gap={36} ratio={n.ratio} restColor={CARD.rest} workColor={CARD.work}>
            {/* 시간만 링 한가운데 — 「총 시간」 문구는 뺐다(사용자 요청 2026-11-03) */}
            <Text style={[s.num, TABULAR, { fontSize: n.long ? 49 : 58, letterSpacing: -0.045 * (n.long ? 49 : 58), paddingTop: 4, color: CARD.text }]}>
              {storyTime(n.total)}
            </Text>
          </StoryRing>
        </View>
        <View style={[s.row, { gap: 10, marginTop: 52 }]}>
          <HeroCard tone="work" label={t('doneScreen.legendWork')} value={storyTime(n.work)} />
          <HeroCard tone="rest" label={t('doneScreen.legendRest')} value={storyTime(n.rest)} />
        </View>
        <View style={[s.row, { justifyContent: 'center', gap: 8, marginTop: 16 }]}>
          <Text style={s.meta}>{t('count.blocks', { count: n.blocks })}</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.meta}>{t('count.rounds', { count: n.rounds })}</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.meta}>{t('count.sets', { count: n.sets })}</Text>
        </View>
      </View>
    </>
  );
}

function HeroCard({ tone, label, value }: { tone: 'work' | 'rest'; label: string; value: string }) {
  const work = tone === 'work';
  return (
    <View
      style={[
        s.heroCard,
        work
          ? { backgroundColor: 'rgba(211,47,62,0.14)', borderColor: 'rgba(211,47,62,0.28)' }
          : { backgroundColor: 'rgba(18,137,124,0.16)', borderColor: 'rgba(18,137,124,0.32)' },
      ]}
    >
      <View style={[s.row, { gap: 5 }]}>
        <View style={[s.dot, { backgroundColor: work ? CARD.work : CARD.rest }]} />
        <Text style={s.heroCardLabel}>{label}</Text>
      </View>
      <Text style={[s.num, TABULAR, { fontSize: 26, color: CARD.text }]}>{value}</Text>
    </View>
  );
}

// ---- 3e 타이포 포스터 ----------------------------------------------------------

function TypePoster({ record }: { record: WorkoutRecord }) {
  const n = numbers(record);
  const workPct = Math.round(n.ratio * 100);
  const big = n.long ? 94 : 124;
  return (
    <>
      <Glows
        id="se"
        base={CARD.bg}
        glows={[
          { cx: -0.1, cy: 0.67, rx: 0.9, ry: 0.55, stops: [[0, CARD.work, 0.42], [0.45, CARD.work, 0.12], [0.72, CARD.work, 0]] },
          { cx: 1.1, cy: 0.67, rx: 0.9, ry: 0.55, stops: [[0, CARD.rest, 0.42], [0.45, CARD.rest, 0.12], [0.72, CARD.rest, 0]] },
        ]}
      />
      <View style={s.darkBody}>
        <DarkHead record={record} />
        {/* 「총 운동 시간」을 빼고 그 높이(10 + 16)만큼 제목 묶음을 내린다 — 사용자 요청 2026-11-03 */}
        <View style={{ marginTop: 166 }}>
          <Text style={s.posterName} numberOfLines={1}>{record.presetName}</Text>
          <Text
            numberOfLines={1}
            style={[
              s.posterNum,
              TABULAR,
              {
                ...tight(big, big * 0.82, n.long ? 22 : 16),
                letterSpacing: -0.065 * big,
                marginLeft: n.long ? -4 : -6,
              },
            ]}
          >
            {storyTime(n.total)}
          </Text>
        </View>
        <View style={{ marginTop: 34 }}>
          <RatioBar ratio={n.ratio} height={12} work={CARD.work} rest={CARD.rest} />
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 12, alignItems: 'flex-start' }]}>
          <View>
            <Text style={[s.num, TABULAR, { fontSize: 30, color: CARD.text }]}>{storyTime(n.work)}</Text>
            <Text style={s.posterLabel}>{t('story.workPct', { p: workPct })}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.num, TABULAR, { fontSize: 30, color: CARD.text }]}>{storyTime(n.rest)}</Text>
            <Text style={s.posterLabel}>{t('story.restPct', { p: 100 - workPct })}</Text>
          </View>
        </View>
        <View style={[s.row, s.posterStats]}>
          <PosterStat value={n.blocks} label={t('story.blocks')} first />
          <PosterStat value={n.rounds} label={t('story.rounds')} />
          <PosterStat value={n.sets} label={t('story.sets')} />
        </View>
      </View>
    </>
  );
}

function PosterStat({ value, label, first }: { value: number; label: string; first?: boolean }) {
  return (
    <View style={[{ flex: 1, paddingTop: 14, gap: 2 }, !first && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 14 }]}>
      <Text style={[s.num, TABULAR, { fontSize: 26, color: CARD.text }]}>{value}</Text>
      <Text style={s.posterStatLabel}>{label}</Text>
    </View>
  );
}

// ---- 내보내기 -------------------------------------------------------------------

/** 고른 카드 하나를 360×640으로 — 찍을 때는 가려져 있어도 된다 */
export const StoryCard = React.forwardRef<
  View,
  { template: StoryTemplate; record: WorkoutRecord; photo?: string }
>(function StoryCard({ template, record, photo }, ref) {
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      {template === 'photoStack' && <PhotoStack record={record} photo={photo} />}
      {template === 'photoStrip' && <PhotoStrip record={record} photo={photo} />}
      {template === 'ringHero' && <RingHero record={record} />}
      {template === 'typePoster' && <TypePoster record={record} />}
    </View>
  );
});

/**
 * 사진 카드에서 글자가 없는 사진 자리의 세로 가운데(360×640 좌표) — 「사진 넣기」를 여기에 띄운다.
 * 3a는 로고(아래 끝 90) ~ 오른쪽 아래 숫자 스택(위 끝 약 410), 3c는 위 글 여백(68) ~
 * 아래 스트립(위 끝 약 410)의 가운데다.
 */
export const PHOTO_SPOT: Record<'photoStack' | 'photoStrip', number> = { photoStack: 250, photoStrip: 239 };

/** 사진이 있어야 공유할 수 있는 카드 */
export const needsPhoto = (t: StoryTemplate) => t === 'photoStack' || t === 'photoStrip';

const s = StyleSheet.create({
  card: { width: SHARE_W, height: SHARE_H, overflow: 'hidden', backgroundColor: CARD.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: 'LeagueSpartan-SemiBold', color: '#FFFFFF' },
  num: { fontFamily: NUM_BOLD, color: '#FFFFFF' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 1 } },
  photoSub: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
  photoName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, color: '#FFFFFF' },
  stripFoot: {
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  darkBody: { flex: 1, paddingTop: 68, paddingHorizontal: 24 },
  darkDate: { fontSize: 11, fontWeight: '600', color: CARD.sub },
  heroName: {
    marginTop: 48,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.96,
    lineHeight: 27.6,
    color: CARD.text,
  },
  heroCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  heroCardLabel: { fontSize: 11, fontWeight: '600', color: '#C9CBD0' },
  meta: { fontSize: 12, fontWeight: '600', color: CARD.sub },
  metaDot: { fontSize: 12, fontWeight: '600', color: '#4A4D53' },
  posterName: { fontSize: 14, fontWeight: '700', color: CARD.legend },
  posterNum: { fontFamily: NUM_EXTRA, color: CARD.text },
  posterLabel: { marginTop: 2, fontSize: 11, fontWeight: '600', color: CARD.sub },
  posterStats: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'stretch',
  },
  posterStatLabel: { fontSize: 11, color: CARD.meta },
});
