/**
 * 기록을 달력에 올리기 위한 셈 — 화면은 그리기만 하고 계산은 여기서 한다.
 *
 * 날짜 키는 `YYYY-M-D`(0을 채우지 않는다). 하루치를 뽑는 일이 셀마다 일어나므로
 * 미리 한 번 묶어 두면 달력 한 장이 O(1) 조회로 그려진다.
 */
import { t } from '../i18n';
import type { WorkoutRecord } from '../types';

export type DayKey = string;

export function dayKeyOf(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function makeKey(y: number, m: number, d: number): DayKey {
  return `${y}-${m}-${d}`;
}

/** 날짜별로 묶는다 — 같은 날 안에서는 **시작한 순서대로** 늘어놓는다 */
export function groupByDay(records: WorkoutRecord[]): Map<DayKey, WorkoutRecord[]> {
  const map = new Map<DayKey, WorkoutRecord[]>();
  for (const r of records) {
    const key = dayKeyOf(r.startedAt);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => a.startedAt - b.startedAt);
  return map;
}

/**
 * 그날 총 시간(분).
 *
 * **반올림은 하루 단위로 한 번만 한다.** 기록마다 반올림해 더하면 1분 30초짜리
 * 두 건이 4분이 된다. 초로 다 더한 뒤에 분으로 바꾼다.
 */
export function dayMinutes(list: WorkoutRecord[] | undefined): number {
  if (!list?.length) return 0;
  return Math.round(list.reduce((a, r) => a + r.totalSec, 0) / 60);
}

/** "23분" · "1시간 33분" — 0이면 빈 문자열 */
export function humanMinutes(total: number): string {
  if (total <= 0) return '';
  if (total < 60) return t('records.minutes', { m: total });
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? t('records.hoursMinutes', { h, m }) : t('records.hours', { h });
}

/**
 * "8월 9일 일요일" — 기록 화면의 그날 머리와 완료 화면이 같은 문장을 쓴다.
 * 두 곳에서 따로 이어붙이면 언젠가 한쪽만 바뀐다.
 */
export function dateLabel(ms: number): string {
  const d = new Date(ms);
  return t('records.dateLabel', {
    m: d.getMonth() + 1,
    d: d.getDate(),
    w: t('records.weekdays').split(' ')[d.getDay()],
  });
}

/** "오전 7:18" — 분은 두 자리로 채운다 */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return t(h24 < 12 ? 'records.amTime' : 'records.pmTime', { h, m });
}

export type MonthStats = {
  /** 운동한 날 수 */
  days: number;
  /** 그 달 총 분 */
  total: number;
  /**
   * 하루 평균 — **운동한 날로만 나눈다.** 쉰 날을 분모에 넣으면 주 3회 하는
   * 사람의 평균이 실제 한 번의 3분의 1로 찍혀, 한 번에 얼마나 하는지를 잃는다.
   */
  average: number;
  /** 그 달 하루 최대 분 — 셀 농도의 기준자 */
  peak: number;
};

export function monthStats(
  byDay: Map<DayKey, WorkoutRecord[]>,
  y: number,
  m: number,
  length: number
): MonthStats {
  let days = 0;
  let total = 0;
  let peak = 0;
  for (let d = 1; d <= length; d++) {
    const v = dayMinutes(byDay.get(makeKey(y, m, d)));
    if (!v) continue;
    days += 1;
    total += v;
    peak = Math.max(peak, v);
  }
  return { days, total, average: days ? Math.round(total / days) : 0, peak };
}

/** 그 달의 날 수와 1일의 요일(0=일) */
export function monthShape(y: number, m: number): { length: number; firstDow: number } {
  return { length: new Date(y, m, 0).getDate(), firstDow: new Date(y, m - 1, 1).getDay() };
}
