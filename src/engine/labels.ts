/**
 * 문구 — 핸드오프 5장 · 6장 「용어 적응」
 *
 * 블록 1개 · 라운드 1인 프리셋에서는 "라운드"·"종목"이라는 말이 어디에도 나오지 않는다.
 *
 * 모든 문장은 카탈로그(src/i18n)에서 통째로 가져온다. 조각을 코드에서 이어붙이면
 * 어순이 다른 언어에서 문장이 무너진다 — "3 / 8 세트"는 영어로 "Set 3 of 8"이다.
 */
import { t } from '../i18n';
import type { Phase, Preset, Segment } from '../types';

export function phaseLabel(phase: Phase): string {
  return t(`phase.${phase}`);
}

/** m:ss — 남은 시간은 올림(ceil)해야 "1"이 사라지기 전에 0초가 되지 않는다 */
export function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const ss = s % 60;
  return `${Math.floor(s / 60)}:${ss < 10 ? '0' : ''}${ss}`;
}

/**
 * 합계용. 초가 0일 때 어떻게 쓰는지는 언어마다 다르다 —
 * 한국어는 시안대로 "23분 0초", 영어는 "23 min"이 자연스럽다.
 */
export function durationLong(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m === 0) return t('duration.sec', { s });
  const rest = s % 60;
  return rest === 0 ? t('duration.minZero', { m }) : t('duration.minSec', { m, s: rest });
}

/** 요약용 — 떨어지는 자리는 생략한다 ("1분", "30초", "1분 30초") */
export function durationShort(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s === 0) return '';
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return t('duration.sec', { s: rest });
  if (rest === 0) return t('duration.min', { m });
  return t('duration.minSec', { m, s: rest });
}

export function isSimple(p: Preset): boolean {
  return p.blocks.length === 1 && p.rounds === 1;
}

/**
 * 다음 구간 예고 — "다음 · 휴식 15초" 의 뒷부분.
 *
 * 운동 구간도 종목 이름이 아니라 "운동"으로 부른다. titleLabel과 같은 이유다 —
 * 이름은 그것이 운동인지 휴식인지 말해주지 않고, 타이머에서는 이름이 곧
 * 타이머 이름이라 화면이 같은 말로 덮인다.
 */
export function describeSegment(seg: Segment | undefined): string {
  if (!seg) return t('segment.none');
  const dur = durationShort(seg.dur);
  switch (seg.phase) {
    case 'WORK':
      return t('segment.work', { dur });
    case 'PREPARE':
      return t('segment.prepare', { dur });
    case 'WARMUP':
      return t('segment.warmup', { dur });
    case 'COOLDOWN':
      return t('segment.cooldown', { dur });
    case 'BLOCK_REST':
      return t('segment.blockRest', { dur });
    case 'ROUND_REST':
      return t('segment.roundRest', { dur });
    default:
      return t('segment.setRest', { dur });
  }
}

/** 「다음」 버튼 라벨 — 도착할 구간을 쓴다 */
/**
 * 구간 버튼의 문구 — 그 버튼을 누르면 **실제로 무엇이 오는지** 그대로 적는다.
 * "휴식 시작"처럼 동작을 덧붙이지 않는다. 운동과 그 사이 휴식에만 세트 번호를 붙인다 —
 * 라운드 휴식·종목 전환에 실려 있는 set은 방금 끝낸 세트라 그 구간을 가리키지 않는다.
 */
export function segLabel(seg: Segment | undefined): string {
  if (!seg) return t('jump.none');
  const name = phaseLabel(seg.phase);
  const numbered = seg.phase === 'WORK' || seg.phase === 'SET_REST';
  if (!numbered || seg.set == null) return name;
  return t('jump.withSet', { name, set: seg.set });
}

/**
 * 컨트롤 위 예고 — "다음 · 스쿼트 40초".
 *
 * 여기서만 종목 이름을 쓴다. 링은 지금이 운동인지 휴식인지를 말하고(그래서
 * 이름을 쓰지 않는다), 이름을 늘어놓던 종목 줄은 없앴다. 남은 자리가 여기다 —
 * 다음에 무엇을 잡아야 하는지는 이름으로 알아야 한다.
 * 타이머는 종목 이름이 곧 타이머 이름이라 이름을 쓰지 않는다.
 */
export function nextLine(seg: Segment | undefined, preset: Preset): string {
  const what =
    seg && seg.phase === 'WORK' && seg.name && !isSimple(preset)
      ? t('run.nextWork', { name: seg.name, dur: durationShort(seg.dur) })
      : describeSegment(seg);
  return t('run.next', { what });
}

/** 링 안쪽 아래 줄 */
export function subLabel(seg: Segment | null, preset: Preset): string {
  if (!seg) return t('sub.finished');
  switch (seg.phase) {
    case 'WARMUP':
      return t('sub.warmup');
    case 'COOLDOWN':
      return t('sub.cooldown');
    case 'PREPARE':
      return t('sub.prepare');
    case 'ROUND_REST':
      return t('sub.roundRest', { round: seg.round });
    case 'BLOCK_REST':
      return t('sub.blockRest', {
        round: seg.round,
        rounds: preset.rounds,
        nth: (seg.blk ?? 0) + 2,
      });
    default:
      // 운동 · 세트 휴식 — 휴식은 방금 끝낸 세트를 유지한다
      if (isSimple(preset)) return t('sub.setsOnly', { set: seg.set, sets: seg.sets });
      return t('sub.setsRounds', {
        set: seg.set,
        sets: seg.sets,
        round: seg.round,
        rounds: preset.rounds,
      });
  }
}

/**
 * 지금 무슨 구간인지.
 *
 * 이름(종목명·타이머명)은 쓰지 않는다. 이름만 있으면 지금이 운동인지 휴식인지
 * 알 수 없고, 타이머는 종목 이름이 곧 타이머 이름이라 화면 전체가 같은 말로
 * 도배된다. 이름은 컨트롤 위의 예고(nextLine)가 든다.
 *
 * 길이(withDur)는 부르는 쪽이 정한다. 링 안에서는 빼고 쓴다 — 큰 숫자가 바로
 * 아래에 있어서 "준비 10초 / 0:09"는 같은 것을 두 번 말하는 셈이다. 미니 바는
 * 남은 시간만 보이므로 전체 길이가 있어야 가늠이 된다.
 */
export function titleLabel(seg: Segment | null, paused: boolean, withDur = true): string {
  if (paused) return t('phase.paused');
  if (!seg) return t('phase.DONE');
  const phase = phaseLabel(seg.phase);
  return withDur ? t('run.titleWithDur', { phase, dur: durationShort(seg.dur) }) : phase;
}

/** 홈 목록 요약 줄 */
export function presetSummary(p: Preset): string {
  if (isSimple(p)) {
    const b = p.blocks[0];
    if (!b) return t('home.noBlocks');
    return t('home.timerSummary', {
      work: durationShort(b.workSec),
      rest: durationShort(b.restSec),
      sets: t('count.sets', { count: b.sets }),
    });
  }
  return t('home.routineSummary', {
    names: p.blocks.map((b) => b.name).join(' · '),
    rounds: t('count.rounds', { count: p.rounds }),
  });
}

/** 홈 목록 시간 줄 — "23분 0초 · 웜업 1분 · 쿨다운 2분" */
export function presetTimeLine(p: Preset, total: number): string {
  const parts = [durationLong(total)];
  if (p.warmupSec > 0) parts.push(t('home.warmupPart', { dur: durationShort(p.warmupSec) }));
  if (p.cooldownSec > 0) parts.push(t('home.cooldownPart', { dur: durationShort(p.cooldownSec) }));
  return parts.join(' · ');
}

/** 종목 행 요약 */
export function blockSummary(workSecV: number, restSec: number, sets: number): string {
  return t('edit.blockSummary', {
    work: durationShort(workSecV),
    rest: durationShort(restSec) || t('common.none'),
    sets: t('count.sets', { count: sets }),
  });
}

/** 잠금화면 알림 문구 — 4장 */
export function notificationText(
  seg: Segment,
  next: Segment | undefined,
  preset: Preset
): { title: string; body: string } {
  if (seg.phase === 'WORK') {
    const body = isSimple(preset)
      ? t('notify.bodySets', { set: seg.set, sets: seg.sets })
      : t('notify.bodySetsRounds', {
          set: seg.set,
          sets: seg.sets,
          round: seg.round,
          rounds: preset.rounds,
        });
    return { title: t('notify.workTitle', { dur: durationShort(seg.dur) }), body };
  }
  return {
    title: describeSegment(seg),
    body: t('notify.bodyNext', { what: next ? nextName(next) : t('phase.DONE') }),
  };
}

function nextName(seg: Segment): string {
  return phaseLabel(seg.phase);
}
