/**
 * 운동 기록 — 월 캘린더와 그날의 상세.
 *
 * 한 화면이 통째로 스크롤된다. 달력만 고정하고 아래만 굴리면 상세를 볼 때마다
 * 달력이 화면의 절반을 차지한 채 남는다 — 이 화면에서 오래 보는 것은 상세다.
 *
 * **색이 1차 정보다.** 날짜 셀의 배경 농도가 그날의 볼륨이라, 숫자를 읽지 않아도
 * 한 달의 리듬이 먼저 보인다. 실행 화면이 페이즈를 색으로 말하는 것과 같은 문법이다.
 */
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../src/components/Icons';
import { useMiniTimerSpace } from '../src/components/MiniTimer';
import { PressBox } from '../src/components/PressBox';
import { Screen } from '../src/components/Screen';
import { useToast } from '../src/components/Toast';
import { clock } from '../src/engine/labels';
import {
  clockTime,
  dayMinutes,
  groupByDay,
  humanMinutes,
  makeKey,
  monthShape,
  monthStats,
} from '../src/engine/records';
import { t } from '../src/i18n';
import { selectionTick } from '../src/feedback';
import { useStore } from '../src/store';
import { C, GUTTER, TABULAR } from '../src/theme';
import type { WorkoutRecord } from '../src/types';

/** 날짜 셀 한 칸의 높이 — 두 줄(날짜·분)이 들어간다 */
const CELL_H = 54;
/**
 * 셀 농도 — 기록이 있으면 최소 이만큼 깔고, 그 달 최대치에 가까울수록 짙어진다.
 * 바닥값이 없으면 짧게 한 날이 아예 안 보여서 "한 날"과 "안 한 날"이 구분되지 않는다.
 */
const TINT_BASE = 0.14;
const TINT_SPAN = 0.42;
/** 날짜 줄과 그 아래 내용 사이 — 머리와 몸이 붙으면 카드가 제목의 일부로 읽힌다 */
const DAY_GAP = 16;

export default function Records() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();
  const { records, deleteRecord } = useStore();
  const toast = useToast();

  /** 오늘 — 미래 잠금과 「오늘」 표시의 기준. 화면이 사는 동안 고정한다 */
  const today = useMemo(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }, []);

  const [view, setView] = useState({ y: today.y, m: today.m });
  const [sel, setSel] = useState(today.d);

  const byDay = useMemo(() => groupByDay(records), [records]);
  const { length, firstDow } = useMemo(() => monthShape(view.y, view.m), [view]);
  const stats = useMemo(
    () => monthStats(byDay, view.y, view.m, length),
    [byDay, view, length]
  );

  /** 이번 달을 보고 있으면 다음 달로 넘어갈 수 없다 — 오지 않은 날에는 볼 것이 없다 */
  const atNow = view.y === today.y && view.m === today.m;

  const step = (dir: -1 | 1) => {
    if (dir === 1 && atNow) return;
    selectionTick();
    setView((v) => {
      const m = v.m + dir;
      if (m < 1) return { y: v.y - 1, m: 12 };
      if (m > 12) return { y: v.y + 1, m: 1 };
      return { y: v.y, m };
    });
    // 달을 옮기면 1일부터 본다 — 앞 달의 31일이 이번 달에 없을 수도 있다
    setSel(1);
  };

  const selKey = makeKey(view.y, view.m, sel);
  const sessions = byDay.get(selKey) ?? [];
  const selDate = new Date(view.y, view.m - 1, sel);
  const weekdays = t('records.weekdays').split(' ');
  const selMinutes = dayMinutes(sessions);
  const selFuture =
    view.y > today.y ||
    (view.y === today.y && (view.m > today.m || (view.m === today.m && sel > today.d)));

  const askDelete = (r: WorkoutRecord) => {
    selectionTick();
    Alert.alert(t('records.deleteTitle'), t('records.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteRecord(r.id);
          toast(t('records.deleted'));
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.header}>
          <PressBox
            onPress={() => router.back()}
            hitSlop={10}
            scaleTo={0.9}
            dim={0}
            accessibilityLabel={t('records.a11yBack')}
          >
            <BackIcon size={26} color={C.textSecondary} />
          </PressBox>
          <Text style={styles.topTitle}>{t('records.title')}</Text>
          {/* 오른쪽은 비워 두되 왼쪽 버튼과 같은 폭을 차지해야 제목이 가운데 선다 */}
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingBottom: insets.bottom + 32 + miniSpace,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.monthRow}>
            <PressBox
              onPress={() => step(-1)}
              scaleTo={0.9}
              dim={0.2}
              radius={13}
              style={styles.monthArrow}
              accessibilityLabel={t('records.a11yPrevMonth')}
            >
              <Text style={styles.arrowGlyph}>‹</Text>
            </PressBox>
            <Text style={[styles.monthLabel, TABULAR]}>
              {t('records.monthLabel', { y: view.y, m: view.m })}
            </Text>
            <PressBox
              onPress={() => step(1)}
              disabled={atNow}
              scaleTo={0.9}
              dim={0.2}
              radius={13}
              style={styles.monthArrow}
              accessibilityLabel={t('records.a11yNextMonth')}
            >
              <Text style={styles.arrowGlyph}>›</Text>
            </PressBox>
          </View>

          <Glass style={styles.summary}>
            <Stat value={`${stats.days}`} label={t('records.days')} divider />
            <Stat
              value={humanMinutes(stats.total) || '—'}
              label={t('records.total')}
              tone={C.volumeText}
              divider
            />
            <Stat value={humanMinutes(stats.average) || '—'} label={t('records.average')} />
          </Glass>

          <View style={styles.weekRow}>
            {weekdays.map((w, i) => (
              <Text
                key={w + i}
                style={[
                  styles.weekday,
                  i === 0 && { color: C.sunday },
                  i === 6 && { color: C.saturday },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {/* 1일 앞의 빈칸 — 요일을 맞춘다 */}
            {Array.from({ length: firstDow }, (_, i) => (
              <View key={`pad${i}`} style={styles.cell} />
            ))}
            {Array.from({ length }, (_, i) => {
              const day = i + 1;
              const mins = dayMinutes(byDay.get(makeKey(view.y, view.m, day)));
              const dow = (firstDow + i) % 7;
              const isSel = day === sel;
              const isToday = atNow && day === today.d;
              const future =
                view.y > today.y ||
                (view.y === today.y && (view.m > today.m || (view.m === today.m && day > today.d)));
              const tint = mins ? TINT_BASE + (mins / Math.max(1, stats.peak)) * TINT_SPAN : 0;

              /*
                고른 날이라고 글자색을 바꾸지 않는다. 고름은 테두리로만 말하고,
                셀 안쪽은 언제나 그날이 어떤 날인지(주말·미래·볼륨)를 그린다.
              */
              let numColor: string = C.textSecondary;
              if (dow === 0) numColor = C.sunday;
              else if (dow === 6) numColor = C.saturday;
              if (future) numColor = 'rgba(154,166,184,0.32)';
              if (mins) numColor = C.textPrimary;

              return (
                <Pressable
                  key={day}
                  onPress={() => {
                    setSel(day);
                    selectionTick();
                  }}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.cellBox,
                      // 볼륨은 고르든 말든 그대로 보인다 — 고름이 정보를 덮으면 안 된다
                      !!mins && { backgroundColor: `rgba(31,179,161,${tint.toFixed(3)})` },
                      // 오늘 표시는 **기록이 없을 때만**. 면이 이미 말하는 자리에 테두리를 더하면 두 번 말하는 것이다
                      isToday && !mins && styles.cellToday,
                      isSel && styles.cellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellDay,
                        TABULAR,
                        { color: numColor, fontWeight: mins || isToday ? '700' : '500' },
                      ]}
                    >
                      {day}
                    </Text>
                    {/*
                      아랫줄이 없으면 **아예 그리지 않는다.** 빈 글자라도 두면 그
                      높이만큼 자리를 차지해서, 기록 없는 날의 숫자가 칸 가운데가
                      아니라 위로 밀린 채 선다.
                    */}
                    {(!!mins || isToday) && (
                      <Text
                        style={[
                          styles.cellMins,
                          TABULAR,
                          { color: mins ? C.volumeText : 'rgba(154,166,184,0.5)' },
                        ]}
                      >
                        {mins ? t('records.minutes', { m: mins }) : t('records.today')}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>
              {t('records.dateLabel', {
                m: view.m,
                d: sel,
                w: weekdays[selDate.getDay()],
              })}
            </Text>
            {sessions.length > 0 && (
              <Text style={[styles.daySummary, TABULAR]}>
                {t('records.daySummary', {
                  count: sessions.length,
                  time: humanMinutes(selMinutes),
                })}
              </Text>
            )}
          </View>

          {sessions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('records.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>
                {t(selFuture ? 'records.emptyFuture' : 'records.emptyRested')}
              </Text>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {sessions.map((r) => (
                <SessionCard key={r.id} record={r} onLongPress={() => askDelete(r)} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

/**
 * 유리 표면 — RN에는 backdrop-filter가 없다. 흐림을 흉내내는 대신 **위에서
 * 아래로 옅어지는 흰 겹**과 얇은 테두리로 같은 인상을 만든다. 뒤가 단색 배경이라
 * 실제로 흐릴 것도 없다.
 */
function Glass({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.glass, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.028)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function Stat({
  value,
  label,
  tone,
  divider,
}: {
  value: string;
  label: string;
  tone?: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={[styles.statValue, TABULAR, !!tone && { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SessionCard({
  record,
  onLongPress,
}: {
  record: WorkoutRecord;
  onLongPress: () => void;
}) {
  const done = record.completed;
  /**
   * 구간 스트립 — 실행 화면 하단 바와 같은 문법이다. 긴 막대가 운동, 짧은 막대가
   * 휴식. 페이즈를 그대로 색칠하지 않고 **운동이냐 아니냐**로만 가른다. 한 줄
   * 8pt 안에서 여섯 가지 색을 구분하려 들면 아무것도 읽히지 않는다.
   */
  const bars = useMemo(() => {
    const segs = record.segs.length ? record.segs : [];
    // 너무 잘게 나뉘면 막대가 실오라기가 된다 — 앞에서부터 40개까지만 그린다
    return segs.slice(0, 40);
  }, [record.segs]);

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={420}>
      <Glass style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {record.presetName}
            </Text>
            <Text style={[styles.cardWhen, TABULAR]} numberOfLines={1}>
              {t('records.startedAt', {
                time: clockTime(record.startedAt),
                shape: record.shape,
              })}
            </Text>
          </View>
          <View style={[styles.tag, done ? styles.tagDone : styles.tagStopped]}>
            <Text style={[styles.tagText, { color: done ? C.volumeText : C.recWarn }]}>
              {t(done ? 'records.tagDone' : 'records.tagStopped')}
            </Text>
          </View>
        </View>

        {bars.length > 0 && (
          <View style={styles.strip}>
            {bars.map((s, i) => (
              <View
                key={i}
                style={{
                  flex: Math.max(0.4, s.durSec),
                  borderRadius: 4,
                  backgroundColor:
                    s.phase === 'WORK' ? 'rgba(240,138,147,0.85)' : 'rgba(31,179,161,0.55)',
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.cardStats}>
          <CardStat value={clock(record.totalSec)} label={t('records.cardTotal')} />
          <CardStat
            value={clock(record.workSec)}
            label={t('records.cardWork')}
            tone={C.recWork}
          />
          <CardStat
            value={t('count.sets', { count: record.completedSets })}
            label={t('records.cardSets')}
          />
        </View>

        {record.blocks.length > 0 && (
          <View style={styles.blockList}>
            {record.blocks.map((b, i) => (
              <View key={`${b.name}${i}`} style={styles.blockRow}>
                <Text style={styles.blockName} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={[styles.blockSpec, TABULAR]} numberOfLines={1}>
                  {b.spec}
                </Text>
                <Text style={[styles.blockDur, TABULAR]}>{clock(b.durSec)}</Text>
              </View>
            ))}
          </View>
        )}
      </Glass>
    </Pressable>
  );
}

function CardStat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.cardStatValue, TABULAR, !!tone && { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.cardStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  topTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.34, color: C.textPrimary },

  monthRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  arrowGlyph: { fontSize: 20, lineHeight: 24, color: C.textSecondary },
  monthLabel: { fontSize: 19, fontWeight: '700', letterSpacing: -0.38, color: C.textPrimary },

  glass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderCurve: 'continuous',
  },
  summary: { marginTop: 16, flexDirection: 'row', borderRadius: 18 },
  stat: { flex: 1, paddingVertical: 15, paddingHorizontal: 8, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' },
  statValue: { fontSize: 21, fontWeight: '700', letterSpacing: -0.52, color: C.textPrimary },
  statLabel: { marginTop: 6, fontSize: 11.5, color: C.textTertiary },

  /*
    요약과 달력은 다른 이야기다 — 위는 한 달을 한 줄로 줄인 것이고, 아래는
    날마다의 것이다. 요일 줄이 요약 카드에 붙어 있으면 카드의 아랫단처럼 읽힌다.
  */
  weekRow: { marginTop: 30, flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '600',
    color: C.textTertiary,
    paddingBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  /** 일곱 칸 — 퍼센트로 나눠야 기기 폭이 달라도 요일이 어긋나지 않는다 */
  cell: { width: `${100 / 7}%`, height: CELL_H, padding: 1 },
  cellBox: {
    flex: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    /*
      테두리는 **모든 칸이 같은 두께로** 들고 있고 색만 바뀐다. 고른 칸에서만
      굵히면 그 칸의 안쪽만 좁아져 숫자가 한 칸 안에서 흔들린다.
    */
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellToday: { borderColor: 'rgba(255,255,255,0.22)' },
  /**
   * 고른 날 — 배경 없이 테두리 하나로만 말한다.
   *
   * 면을 칠하면 그 자리의 볼륨 농도가 지워져, 고르는 순간 그날이 얼마나 한
   * 날이었는지를 잃는다. 테두리는 아무것도 덮지 않는다. 두께는 다른 셀과 같은
   * 1이다 — 굵히면 그 칸만 안쪽이 좁아져 숫자가 흔들린다.
   */
  cellSelected: { borderColor: C.volumeText },
  cellDay: { fontSize: 14.5, lineHeight: 17 },
  cellMins: { fontSize: 10.5, fontWeight: '600', lineHeight: 13 },

  divider: { height: 1, backgroundColor: C.divider, marginTop: 16, marginBottom: 16 },

  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayLabel: { fontSize: 17, fontWeight: '700', letterSpacing: -0.34, color: C.textPrimary },
  daySummary: { fontSize: 13, color: C.textTertiary },

  /** 날짜 줄과 그날의 내용 사이 — 카드든 빈 상태든 같은 자리에서 시작한다 */
  sessionList: { marginTop: DAY_GAP, gap: 12 },
  empty: {
    marginTop: DAY_GAP,
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  emptyHint: { marginTop: 8, fontSize: 13, lineHeight: 21, color: C.textTertiary },

  card: { marginTop: 0, borderRadius: 20, padding: 16, gap: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.26, color: C.textPrimary },
  cardWhen: { marginTop: 5, fontSize: 12.5, color: C.textTertiary },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  tagDone: { backgroundColor: 'rgba(31,179,161,0.14)', borderColor: 'rgba(31,179,161,0.32)' },
  tagStopped: { backgroundColor: 'rgba(232,161,92,0.14)', borderColor: 'rgba(232,161,92,0.32)' },
  tagText: { fontSize: 11.5, fontWeight: '700' },

  strip: { flexDirection: 'row', gap: 3, height: 8 },

  cardStats: { flexDirection: 'row', gap: 14 },
  cardStatValue: { fontSize: 17, fontWeight: '700', letterSpacing: -0.34, color: C.textPrimary },
  cardStatLabel: { marginTop: 4, fontSize: 11, color: C.textTertiary },

  blockList: {
    borderRadius: 13,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 1,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  blockName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.textPrimary },
  blockSpec: { marginRight: 12, fontSize: 12.5, color: C.textSecondary },
  blockDur: { fontSize: 12.5, fontWeight: '600', color: C.volumeText },
});
