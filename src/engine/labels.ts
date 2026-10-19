/**
 * 문구 — 핸드오프 5장 · 6장 「용어 적응」
 *
 * 블록 1개 · 라운드 1인 프리셋에서는 "라운드"·"종목"이라는 말이 어디에도 나오지 않는다.
 *
 * 모든 문장은 카탈로그(src/i18n)에서 통째로 가져온다. 조각을 코드에서 이어붙이면
 * 어순이 다른 언어에서 문장이 무너진다 — "3 / 8 세트"는 영어로 "Set 3 of 8"이다.
 */
import { t } from '../i18n';
import type { Plan } from './segments';
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

/**
 * 구간 버튼의 문구 — 그 버튼을 누르면 **실제로 무엇이 오는지** 그대로 적는다.
 * "휴식 시작"처럼 동작을 덧붙이지 않는다. 운동과 그 사이 휴식에만 세트 번호를 붙인다 —
 * 라운드 휴식·종목 전환에 실려 있는 set은 방금 끝낸 세트라 그 구간을 가리키지 않는다.
 *
 * **다른 종목으로 건너갈 때는 종목 이름을 붙인다.** 준비·종목 전환·라운드 휴식에서
 * 「운동 · 1세트」만 보이면 무엇을 하러 가는지 알 수 없다 — 그 자리에서는 링 제목도
 * 다음 종목을 말해주지 않기 때문에 이 버튼이 유일한 단서다.
 *
 * 반대로 세트 사이 휴식에서는 붙이지 않는다. 링 제목이 이미 그 이름을 들고 있어
 * 같은 말이 두 번 된다. 그래서 판단 기준은 도착점이 아니라 **지금 있는 자리가 그
 * 종목에 속하는가**다. 타이머(종목 1·라운드 1)는 종목 이름이 곧 타이머 이름이라
 * 어느 경우에도 붙이지 않는다.
 */
export function segLabel(seg: Segment | undefined, from?: Segment | null, preset?: Preset): string {
  if (!seg) return t('jump.none');
  const phase = phaseLabel(seg.phase);
  const numbered = seg.phase === 'WORK' || seg.phase === 'SET_REST';

  const crossing =
    seg.phase === 'WORK' &&
    !!seg.name &&
    !(preset && isSimple(preset)) &&
    // 지금 자리가 그 종목의 것이 아니면 건너가는 길이다 (준비·종목 전환·라운드 휴식)
    (!from || from.blockId !== seg.blockId || from.round !== seg.round);

  if (crossing) {
    /*
      첫 세트 번호는 붙이지 않는다. 새 종목은 늘 1세트부터라 「플랭크 · 1세트」의
      뒷부분은 아무것도 말해 주지 않고, 이름이 길면 그 자리를 밀어내 이름 쪽이
      먼저 줄어든다 — 종목 전환에서 이 버튼의 쓸모는 오직 그 이름인데. 다른
      종목의 **뒤 세트**로 되돌아가는 길(휴식이 0초인 종목에서 ⏮)에만 번호를 단다.
    */
    if (seg.set == null) return t('jump.block', { block: seg.name, name: phase });
    if (seg.set === 1) return seg.name ?? phase; // crossing이 이미 이름을 보장한다 — 타입만 좁힌다
    return t('jump.blockWithSet', { block: seg.name, name: phase, set: seg.set });
  }

  if (!numbered || seg.set == null) return phase;
  return t('jump.withSet', { name: phase, set: seg.set });
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
 * 미니 바의 한 줄 — "운동 30초".
 *
 * 여기서는 길이를 함께 쓴다. 남은 시간 하나만 보이는 자리라, 전체가 얼마짜리인지
 * 없으면 30초 중 20초인지 3분 중 20초인지 가늠이 안 된다.
 */
export function titleLabel(seg: Segment | null, paused: boolean): string {
  if (paused) return t('phase.paused');
  if (!seg) return t('phase.DONE');
  return t('run.titleWithDur', { phase: phaseLabel(seg.phase), dur: durationShort(seg.dur) });
}

/**
 * 링 안쪽 위 — "스쿼트 · 운동".
 *
 * 이름과 무엇인지를 한 줄에 붙인다. 이름만으로는 지금이 운동인지 휴식인지 알 수
 * 없고, 무엇인지만으로는 어느 종목인지 알 수 없다 — 운동 중에 볼 수 있는 글자가
 * 이 한 줄뿐인 때가 많으니 둘 다 있어야 한다.
 *
 * 길이는 쓰지 않는다. 바로 아래 큰 숫자가 남은 시간을 말하고 있어서, 제목까지
 * 시간을 들면 같은 것을 두 번 말하는 셈이다.
 *
 * 이름을 붙이는 것은 운동과 그 사이 휴식뿐이다. 웜업·준비·쿨다운에는 종목이
 * 없고, 종목 전환·라운드 휴식에 실린 이름은 방금 끝낸 종목이라 지금을 가리키지
 * 않는다. 타이머는 종목 이름이 곧 타이머 이름이라 붙이지 않는다.
 *
 * **멈춰 있어도 "일시정지"로 갈아치우지 않는다.** 멈춘 것은 한가운데 커다란 ▶와
 * 멈춰 선 숫자가 이미 말한다. 그 한마디를 얹자고 지금 무엇을 하던 중이었는지를
 * 가리면, 다시 시작할 때 화면을 다시 읽어야 한다. (미니 바는 다르다 — 거기는
 * 글자 한 줄이 전부라 titleLabel이 "일시정지"를 그대로 든다.)
 */
export type RingTitle = {
  /**
   * 종목 이름 — 있으면 링은 두 줄로 그린다: 위에 단계 칩(rest), 아래에 이 이름.
   * 길면 줄이고, 바닥까지 줄여도 안 들어가면 이름에 말줄임이 붙는다.
   * 이름이 안 붙는 자리(웜업·준비·쿨다운·완료)에서는 null.
   */
  name: string | null;
  /** 이름이 있으면 칩에 서는 단계말("운동"), 없으면 홀로 서는 온말("준비") */
  rest: string;
  /** 종목 메모 — 이름 밑 한 줄. 이름이 없거나 메모가 비어 있으면 없다 */
  memo?: string;
};

export function ringTitle(seg: Segment | null, _paused: boolean, preset: Preset): RingTitle {
  if (!seg) return { name: null, rest: t('phase.DONE') };
  const phase = phaseLabel(seg.phase);
  const named = seg.phase === 'WORK' || seg.phase === 'SET_REST';
  if (!named || !seg.name || isSimple(preset)) return { name: null, rest: phase };
  const memo = preset.blocks.find((b) => b.id === seg.blockId)?.memo?.trim();
  return { name: seg.name, rest: phase, memo: memo || undefined };
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
  /**
   * 「운동 30초」 앞에 종목 이름을 붙인다 — 「인클라인 덤벨 프레스 · 운동 30초」.
   *
   * 잠금화면에서는 이 한 줄이 전부다. 화면을 켜지 않고 알림만 보는 자리라
   * 「운동 30초」만 있으면 **무엇을** 30초 하는지가 빠진다. 이름을 앞에 두는
   * 것은 알림 목록에서 뒤가 잘려도 이름은 남기 때문이다.
   *
   * 종목에 속한 자리(운동·그 사이 휴식)에만 붙는다. 웜업·준비·라운드 휴식·
   * 쿨다운은 어느 종목의 것도 아니다. 타이머(종목 하나짜리)에도 안 붙인다 —
   * 고를 종목이 없어서 이름이 아무것도 가르지 않는다. 실행 화면의 링이
   * 이름을 감추는 규칙(ringTitle)과 같다.
   */
  const named = (what: string): string => {
    const inBlock = seg.phase === 'WORK' || seg.phase === 'SET_REST';
    const name = inBlock && !isSimple(preset) ? seg.name?.trim() : undefined;
    return name ? t('notify.named', { name, what }) : what;
  };

  if (seg.phase === 'WORK') {
    const body = isSimple(preset)
      ? t('notify.bodySets', { set: seg.set, sets: seg.sets })
      : t('notify.bodySetsRounds', {
          set: seg.set,
          sets: seg.sets,
          round: seg.round,
          rounds: preset.rounds,
        });
    return { title: named(t('notify.workTitle', { dur: durationShort(seg.dur) })), body };
  }
  const nextLine = t('notify.bodyNext', {
    what: next ? nextName(next, seg, preset) : t('phase.DONE'),
  });
  /*
    휴식에도 운동 알림과 같은 「몇 세트 · 몇 라운드」 줄을 윗줄에 둔다 — 잠금화면만
    보고 쉬는 동안 「지금 몇 번째였더라」가 가장 궁금하다. 운동 알림에서 본 숫자가
    휴식에서 사라지면 휴식 30초 내내 그것을 셀 길이 없다.

    세트는 **방금 끝낸 세트**다(실행 화면의 링 아랫줄 subLabel과 같다). 종목·라운드
    사이 휴식은 그 종목의 마지막 세트를 들고 있어 「4 / 4세트」로 읽힌다. 덧붙인
    종목 앞의 전환(꼬리)은 **다음** 종목의 1세트를 들고 있어 숫자가 거짓말이 되므로
    뺀다 — 라운드 안의 전환은 늘 마지막 세트(set === sets)라 그것으로 가린다.
  */
  const counted =
    seg.set != null &&
    seg.sets != null &&
    (seg.phase === 'SET_REST' ||
      ((seg.phase === 'BLOCK_REST' || seg.phase === 'ROUND_REST') && seg.set === seg.sets));
  const progress = !counted
    ? null
    : isSimple(preset)
      ? t('notify.bodySets', { set: seg.set, sets: seg.sets })
      : t('notify.bodySetsRounds', {
          set: seg.set,
          sets: seg.sets,
          round: seg.round,
          rounds: preset.rounds,
        });
  return {
    title: named(describeSegment(seg)),
    body: progress ? `${progress}\n${nextLine}` : nextLine,
  };
}

/**
 * 「다음 · …」의 뒷부분 — **다른 종목으로 건너갈 때는 종목 이름을 붙인다.**
 *
 * 제목이 종목 이름을 앞세우게 된 뒤에도(named) 이 줄은 「다음 · 운동」이었다.
 * 그래서 종목 전환에서 잠금화면에 「스쿼트 · 종목 전환 30초 / 다음 · 운동」이
 * 뜬다 — 방금 끝낸 것은 아는데 **무엇을 하러 일어나야 하는지**가 없다. 종목이
 * 바뀌는 자리가 바로 그 이름이 가장 필요한 자리다.
 *
 * 기준은 실행 화면의 「다음」 버튼(segLabel)과 같다: **지금 있는 자리가 그
 * 종목에 속하지 않을 때만** 붙인다. 같은 종목의 세트 사이 휴식은 제목이 이미
 * 그 이름을 들고 있어 같은 말이 두 번 되고, 타이머(종목 1·라운드 1)는 종목
 * 이름이 곧 타이머 이름이라 어느 경우에도 붙이지 않는다.
 */
function nextName(seg: Segment, from: Segment, preset: Preset): string {
  const phase = phaseLabel(seg.phase);
  if (seg.phase !== 'WORK' || !seg.name || isSimple(preset)) return phase;
  if (from.blockId === seg.blockId && from.round === seg.round) return phase;
  return t('jump.block', { block: seg.name, name: phase });
}

/**
 * 구성 한 줄 — "3종목 2라운드". 기록에 베껴 두는 문장이라 짧아야 한다.
 * 타이머(종목 1·라운드 1)는 종목이라는 말 자체를 쓰지 않으므로 세트 수로 대신한다.
 */
export function shapeLabel(p: Preset, extraBlocks = 0): string {
  /*
    실행 중에 「운동 더 하기」로 붙인 종목까지 센다. 프리셋의 blocks만 보면
    두 종목을 했는데 기록에는 「1종목」으로 남는다 — 그 줄이 가리키는 것은
    루틴의 설계가 아니라 **그날 한 운동**이다.
  */
  const blocks = p.blocks.length + extraBlocks;
  if (isSimple(p) && extraBlocks === 0) {
    const b = p.blocks[0];
    return b ? t('count.sets', { count: b.sets }) : '';
  }
  return t('doneScreen.composition', {
    blocks: t('count.blocks', { count: blocks }),
    rounds: t('count.rounds', { count: p.rounds }),
  });
}

/**
 * 이 운동이 지나가는 자리들 — 웜업 · 준비 · 종목(라운드마다 다시) · 쿨다운.
 *
 * 실행 화면 하단 눈금과 「3 / 9 구간」, 라이브 액티비티의 같은 줄이 이것을 쓴다.
 * 계획에서 뽑는다 — 프리셋이 아니라 **실제로 돌 차례**여야 하고, 그건 실행 중에
 * 바뀔 수 있기 때문이다. 휴식은 자리로 세지 않는다 — 어디에서 어디로 가는
 * 사이일 뿐이라, 그 동안에는 **도착할** 자리를 지금으로 친다.
 *
 * stageOf[i]는 구간 i가 속한 자리의 번호다.
 */
export function planStages(plan: Plan | null | undefined): {
  stages: { key: string; name: string; start: number; end: number }[];
  stageOf: number[];
} {
  const segs = plan?.segs ?? [];
  const stages: { key: string; name: string; start: number; end: number }[] = [];
  const stageOf: number[] = [];
  let occ = '';
  segs.forEach((s, i) => {
    switch (s.phase) {
      case 'WARMUP':
      case 'PREPARE':
      case 'COOLDOWN':
        if (stages[stages.length - 1]?.key !== s.phase) {
          stages.push({ key: s.phase, name: phaseLabel(s.phase), start: s.start, end: s.start });
        }
        break;
      case 'WORK': {
        const key = `${s.round}-${s.blk}`;
        if (key !== occ) {
          occ = key;
          stages.push({ key, name: s.name ?? '', start: s.start, end: s.start });
        }
        break;
      }
    }
    // 종목·라운드 사이 휴식은 아직 만들어지지 않은 다음 자리를 가리킨다
    const ahead = s.phase === 'BLOCK_REST' || s.phase === 'ROUND_REST';
    stageOf[i] = ahead ? stages.length : stages.length - 1;
  });

  /*
    **가리킬 자리가 안 생긴 휴식은 있던 자리로 되돌린다.**

    위에서 종목·라운드 사이 휴식은 «아직 만들어지지 않은 다음 자리»를 가리키게
    했는데, 그 뒤에 정말로 자리가 생겼는지는 다 훑고 나서야 안다 — 마지막
    라운드 휴식이나 꼬리 끝의 전환처럼 뒤가 비는 경우가 있다.

    한때 `Math.min(stages.length - 1, ...)`을 그 자리에서 걸었는데, 그러면
    «다음»이 늘 «지금»으로 눌려서 앞을 가리키는 일 자체가 없었다 — 주석은
    가리킨다고 적혀 있는데 코드는 안 가리키고 있었다.
  */
  const last = stages.length - 1;
  for (let i = 0; i < stageOf.length; i++) stageOf[i] = Math.min(stageOf[i], last);

  /**
   * 자리마다 시간 폭을 매긴다 — 하단 눈금이 이 폭으로 나뉜다.
   * 어느 초도 빠지지 않아야 눈금이 진행 바 노릇을 한다. 휴식은 도착할 자리에
   * 얹혀 있으므로, 자리의 폭은 그 자리에 속한 구간들의 처음부터 끝까지다.
   */
  segs.forEach((s, i) => {
    const k = stageOf[i];
    if (k < 0 || !stages[k]) return;
    stages[k].start = Math.min(stages[k].start, s.start);
    stages[k].end = Math.max(stages[k].end, s.start + s.dur);
  });

  return { stages, stageOf };
}

/**
 * 라이브 액티비티(다이내믹 아일랜드 · 잠금화면)에 적을 세 줄 — 단계 · 이름 · 곁말.
 *
 * 디자인(인타바 다이내믹 아일랜드 1b)의 규칙이다.
 *   · 운동 — 이름 자리에 지금 종목, 곁말에 「1 / 4 세트 · 다음: 휴식 30초」
 *   · 휴식 — 이름 자리에 「다음: ○○」 예고, 곁말에 세트·라운드
 * 쉬는 동안 궁금한 것은 방금 끝낸 것이 아니라 **일어나서 할 것**이라 이름 자리를
 * 다음 종목에 내준다. 같은 종목의 세트 사이 휴식이어도 종목 이름을 댄다 — 잠금화면
 * 알림의 nextName과 달리 여기에는 제목 줄이 따로 없어 이름이 두 번 서지 않는다.
 *
 * 타이머(종목 하나)는 종목 이름이 곧 타이머 이름이다.
 */
export function liveText(
  seg: Segment | null,
  next: Segment | undefined,
  preset: Preset
): { phase: string; name: string; sub: string } {
  if (!seg) {
    return { phase: phaseLabel('DONE'), name: preset.name, sub: t('sub.finished') };
  }
  const phase = phaseLabel(seg.phase);
  const own = isSimple(preset) ? preset.name : (seg.name ?? preset.name);
  const upcoming = (): string => {
    if (!next) return phaseLabel('DONE');
    if (next.phase === 'WORK' && next.name && !isSimple(preset)) return next.name;
    return describeSegment(next);
  };
  switch (seg.phase) {
    case 'WORK':
      return {
        phase,
        name: own,
        sub: t('live.subWork', { sub: subLabel(seg, preset), next: upcoming() }),
      };
    case 'SET_REST':
    case 'BLOCK_REST':
    case 'ROUND_REST':
      return { phase, name: t('live.next', { what: upcoming() }), sub: subLabel(seg, preset) };
    default:
      // 웜업 · 준비 · 쿨다운 — 어느 종목의 것도 아니다. 루틴 이름을 세운다
      return { phase, name: preset.name, sub: subLabel(seg, preset) };
  }
}
