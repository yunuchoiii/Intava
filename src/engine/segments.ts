/**
 * 핸드오프 3장 — 구간 전개 규칙 · 총 소요 시간
 *
 * `LiveFlat.dc.html`의 build() 를 그대로 옮긴 것이다. 이 배열이 실행 화면,
 * 알림 예약, 완료 화면 통계, 편집 화면 합계의 유일한 출처다.
 */
import type { Phase, Preset, Segment } from '../types';

export type Plan = {
  segs: Segment[];
  total: number;
};

/**
 * 라운드마다 종목을 어떤 차례로 돌지 — 종목 id의 배열, 라운드 수만큼.
 *
 * 실행 중에 순서를 바꾸면 지나간 라운드는 그대로 두고 이번 라운드부터만 새 차례를
 * 쓴다. 그래서 라운드 하나가 아니라 라운드별로 따로 들고 있어야 한다.
 * 없으면(평소) 프리셋에 적힌 차례를 그대로 쓴다.
 */
export type RoundOrders = string[][];

/**
 * 라운드마다 어떤 종목을 **빼고** 돌지 — 종목 id의 배열, 라운드 수만큼.
 *
 * 차례(RoundOrders)와 나란한 두 번째 축이다. 뺀 것을 차례에서 지워버리지 않는
 * 이유는 순서 시트 때문이다 — 목록에서 사라지면 다시 넣을 자리가 없다. 차례는
 * 언제나 종목 전부를 들고 있고, 여기 든 id만 계획을 펼 때 걸러진다.
 */
export type RoundSkips = string[][];

/**
 * 주어진 차례대로 종목을 늘어놓고, 빼기로 한 것을 걸러낸다.
 *
 * 실행 중에 편집 화면에서 종목이 추가·삭제될 수 있으므로 id를 곧이곧대로 믿지
 * 않는다. 없어진 id는 버리고, 차례에 없는 종목은 뒤에 붙인다 — 사용자가 빼기로
 * 한 것 말고는 하나도 빠지지 않게 한다.
 */
function roundBlocks(p: Preset, ids: string[] | undefined, skip: string[] | undefined) {
  let list = p.blocks;
  if (ids) {
    const picked = ids.map((id) => p.blocks.find((b) => b.id === id)).filter((b) => !!b);
    const rest = p.blocks.filter((b) => !picked.includes(b));
    list = [...picked, ...rest];
  }
  if (!skip?.length) return list;
  const kept = list.filter((b) => !skip.includes(b.id));
  // 전부 빠지면 빼기를 통째로 무시한다 — 종목 0개짜리 라운드는 계획에 구멍을 낸다
  return kept.length ? kept : list;
}

export function buildPlan(p: Preset, orders?: RoundOrders, skips?: RoundSkips): Plan {
  const segs: Segment[] = [];
  let t = 0;

  if (p.warmupSec > 0) {
    segs.push({ phase: 'WARMUP', start: t, dur: p.warmupSec });
    t += p.warmupSec;
  }
  if (p.prepareSec > 0) {
    segs.push({ phase: 'PREPARE', start: t, dur: p.prepareSec });
    t += p.prepareSec;
  }

  for (let r = 1; r <= p.rounds; r++) {
    /*
      길이는 라운드마다 다를 수 있다 — 도중에 종목을 빼면 그 라운드부터 짧아진다.
      상한과 "마지막 종목"을 프리셋의 종목 수로 재면 blocks[b]가 undefined가 된다.
    */
    const blocks = roundBlocks(p, orders?.[r - 1], skips?.[r - 1]);
    const B = blocks.length;
    for (let b = 0; b < B; b++) {
      const bl = blocks[b];
      for (let s = 1; s <= bl.sets; s++) {
        // blk은 **이 라운드에서 몇 번째**인지다. 순서가 바뀌면 같은 종목이라도 달라진다.
        // 종목을 가리키려면 blockId를 본다.
        const meta = { round: r, blk: b, set: s, sets: bl.sets, name: bl.name, blockId: bl.id };
        segs.push({ phase: 'WORK', ...meta, start: t, dur: bl.workSec });
        t += bl.workSec;

        const lastSet = s === bl.sets;
        const lastBlk = b === B - 1;
        const lastRound = r === p.rounds;

        if (!lastSet) {
          segs.push({ phase: 'SET_REST', ...meta, start: t, dur: bl.restSec });
          t += bl.restSec;
        } else if (lastBlk && lastRound) {
          // 다 끝났다 — 쉴 것이 없다. 뒤에 올 종목도 라운드도 없으므로 곧장 쿨다운으로 간다.
        } else if (lastBlk) {
          segs.push({ phase: 'ROUND_REST', ...meta, start: t, dur: p.roundRestSec });
          t += p.roundRestSec;
        } else {
          /*
            마지막 세트 뒤에도 그 종목의 휴식이 돈다 — 이것이 다음 종목까지의 간격이다.

            예전에는 여기서 별도의 종목 전환(BLOCK_REST, blockRestSec)을 끼웠는데,
            "마지막 세트만 휴식이 다르다"는 것이 체감상 어긋났다. 전환이라는 별도
            구간 없이 종목의 휴식 리듬이 끝까지 이어지고, 프리셋의 blockRestSec은
            더 이상 계획에 쓰이지 않는다(타입에는 옛 데이터 호환으로 남는다).
          */
          segs.push({ phase: 'SET_REST', ...meta, start: t, dur: bl.restSec });
          t += bl.restSec;
        }
      }
    }
  }

  if (p.cooldownSec > 0) {
    segs.push({ phase: 'COOLDOWN', start: t, dur: p.cooldownSec });
    t += p.cooldownSec;
  }

  return { segs: segs.filter((s) => s.dur > 0), total: t };
}

/** 총 소요 시간 (전개 없이 계산 — 편집 화면에서 값이 바뀌는 내내 갱신) */
export function totalSec(p: Preset): number {
  return buildPlan(p).total;
}

/** 순수 운동 시간 */
export function workSec(p: Preset): number {
  const per = p.blocks.reduce((a, b) => a + b.workSec * b.sets, 0);
  return per * p.rounds;
}

/** 전체 세트 수 — 블록별 세트 합 × 라운드 */
export function totalSets(p: Preset): number {
  return p.blocks.reduce((a, b) => a + b.sets, 0) * p.rounds;
}

/**
 * 실제로 지나온 만큼 — 완료 화면의 숫자.
 *
 * 계획이 아니라 **몸으로 통과한 것**만 센다. 넘기기(⏭)는 시계를 통째로 앞으로
 * 밀기 때문에, 흐른 시간을 그대로 쓰면 1분 만에 넘겨 끝낸 운동도 23분으로 잡힌다.
 * 그래서 어디까지 세었는지(at)를 들고 다니면서, 시계가 뛴 자리는 건너뛰고
 * 이어서 흐른 구간만 더한다.
 */
/** 실제로 지나온 구간 하나 — [시작, 끝] (초) */
export type Span = [number, number];

/**
 * 이만큼도 안 지난 것은 지나지 않은 것으로 본다.
 *
 * 종목을 시작하자마자 넘겨도 0.5초쯤은 흐르는데, 반올림하면 1초가 되어 기록의
 * 표에 한 줄이 선다. 하지도 않은 종목이 목록에 남는 셈이라 이만큼은 걸러낸다.
 */
const MIN_LIVED_SEC = 1;

export type Lived = {
  /** 여기까지 세었다 — 되돌아가도 내려가지 않는다(같은 세트를 두 번 세지 않게) */
  at: number;
  /** 실제로 흐른 시간 (멈춰 있던 동안과 건너뛴 구간은 빠진다) */
  total: number;
  /** 그중 운동 구간에서 보낸 시간 */
  work: number;
  /** 끝까지 지나온 세트 · 라운드 */
  sets: number;
  rounds: number;
  /**
   * 실제로 지나온 구간들 — 넘긴 자리는 여기 빠져 있다.
   *
   * `at` 하나로는 "어디까지 갔는가"밖에 모른다. 종목을 통째로 넘기면 `at`은 그
   * 너머로 뛰지만 그 사이를 몸으로 지난 것은 아니다. 기록의 종목별 표와 구간
   * 스트립이 계획이 아니라 실제를 그리려면 이 이력이 있어야 한다.
   */
  spans: Span[];
};

export const NO_LIVED: Lived = { at: 0, total: 0, work: 0, sets: 0, rounds: 0, spans: [] };

/**
 * 지나온 구간 목록을 꺼낸다.
 *
 * 옛 저장분에는 `spans`가 없다(이 필드가 생기기 전에 시작한 세션). 그때의
 * 셈법대로 "0부터 at까지 다 지났다"로 갈음한다 — 없다고 기록을 통째로 비우는
 * 것보다 낫다.
 */
export function livedSpans(lived: Lived | undefined): Span[] {
  if (!lived) return [];
  if (lived.spans?.length) return lived.spans;
  return lived.at > 0 ? [[0, lived.at]] : [];
}

/** 맞닿거나 겹치면 앞 구간을 늘린다 — 1초마다 새 구간이 쌓이면 배열이 끝없이 자란다 */
function addSpan(spans: Span[], from: number, to: number): Span[] {
  if (to <= from) return spans;
  const last = spans[spans.length - 1];
  if (last && from <= last[1] + 0.01) {
    return [...spans.slice(0, -1), [last[0], Math.max(last[1], to)]];
  }
  return [...spans, [from, to]];
}

/** at부터 to까지 이어서 흘렀다고 보고 셈을 더한다. 뒤로 간 것은 세지 않는다 */
export function advanceLived(lived: Lived | undefined, plan: Plan, to: number): Lived {
  const cur = lived ?? NO_LIVED;
  const end = Math.max(0, Math.min(plan.total, to));
  if (end <= cur.at) return cur;

  // 라운드의 마지막 운동 구간 — 그것을 지나야 그 라운드를 다 한 것이다
  const lastOfRound = new Map<number, number>();
  plan.segs.forEach((s, i) => {
    if (s.phase === 'WORK' && s.round != null) lastOfRound.set(s.round, i);
  });

  let work = 0;
  let sets = 0;
  let rounds = 0;
  plan.segs.forEach((s, i) => {
    if (s.phase !== 'WORK') return;
    const segEnd = s.start + s.dur;
    const lo = Math.max(cur.at, s.start);
    const hi = Math.min(end, segEnd);
    if (hi > lo) work += hi - lo;
    if (segEnd > cur.at && segEnd <= end + 0.01) {
      sets += 1;
      if (s.round != null && lastOfRound.get(s.round) === i) rounds += 1;
    }
  });

  return {
    at: end,
    total: cur.total + (end - cur.at),
    work: cur.work + work,
    sets: cur.sets + sets,
    rounds: cur.rounds + rounds,
    // 방금 흘린 창을 이력에 남긴다 — 넘긴 자리는 창 사이로 빠진다
    spans: addSpan(livedSpans(cur), cur.at, end),
  };
}

/** offset(초)이 속한 구간. 전체가 끝났으면 null */
export function segmentAt(plan: Plan, elapsed: number): { seg: Segment; idx: number } | null {
  for (let i = 0; i < plan.segs.length; i++) {
    const s = plan.segs[i];
    if (elapsed < s.start + s.dur) return { seg: s, idx: i };
  }
  return null;
}

/**
 * 지나온 만큼을 기록용으로 간추린다 — **구간 이력(spans)과 겹치는 만큼만** 센다.
 *
 * 예전에는 `until` 하나만 받아 `[0, until)`을 통째로 지나온 것으로 셌다. 넘기기가
 * 구간 하나짜리였을 때는 그럭저럭 맞았지만, 종목을 통째로 넘기면 5초 만에 건너뛴
 * 종목이 기록에 풀 시간으로 남는다 — 하지도 않은 운동이 표에 서고 구간 스트립에도
 * 그려진다. `Lived.total`은 창 단위로 정확히 세는데 여기만 셈법이 달랐다.
 *
 * 종목은 자리(blk)가 아니라 **정체(blockId)로** 묶는다. 라운드가 여러 번 돌면
 * 같은 종목이 여러 자리에 나타나는데, 기록에서는 "스쿼트에 몇 분"이 알고 싶은
 * 것이지 "세 번째 자리에 몇 분"이 아니다. 순서를 바꿔가며 돌아도 한 줄로 모인다.
 *
 * 걸쳐 있는 구간은 지나온 만큼만 센다 — 40초짜리 운동을 12초에서 껐으면 12초다.
 *
 * **운동을 거의 안 한 종목은 뺀다.** 첫 세트를 시작하자마자 넘긴 것은 그 종목을
 * 했다고 할 수 없다. 판단 기준은 그 종목에서 보낸 전체 시간이 아니라 **운동
 * 구간에서 보낸 시간**이다 — 앞 종목의 종목 전환 휴식이 이 종목 몫으로 붙는 일은
 * 없지만, 넘기고 나서 흐른 휴식이 붙어 "했다"로 읽히면 곤란하다.
 */
export function summarizeLived(
  plan: Plan,
  spans: Span[]
): { blocks: { blockId: string; name: string; durSec: number }[]; segs: { phase: Phase; durSec: number }[] } {
  type Tally = { blockId: string; name: string; durSec: number; workSec: number };
  const order: string[] = [];
  const byBlock = new Map<string, Tally>();
  const segs: { phase: Phase; durSec: number }[] = [];

  for (const s of plan.segs) {
    const segEnd = s.start + s.dur;
    let lived = 0;
    for (const [from, to] of spans) {
      if (to <= s.start) continue;
      // spans는 오름차순이라, 이 구간을 넘어선 뒤로는 볼 것이 없다
      if (from >= segEnd) break;
      lived += Math.min(to, segEnd) - Math.max(from, s.start);
    }
    // 부동소수 오차로 꽉 채운 1초짜리 구간이 탈락하지 않게 여유를 준다
    if (lived < MIN_LIVED_SEC - 0.01) continue;
    segs.push({ phase: s.phase, durSec: lived });

    // 종목에 딸린 구간만 종목 몫으로 센다 — 웜업·쿨다운·라운드 휴식은 어느 종목의 것도 아니다
    const owned = s.phase === 'WORK' || s.phase === 'SET_REST' || s.phase === 'BLOCK_REST';
    if (!owned || !s.blockId) continue;
    const work = s.phase === 'WORK' ? lived : 0;
    const cur = byBlock.get(s.blockId);
    if (cur) {
      cur.durSec += lived;
      cur.workSec += work;
    } else {
      order.push(s.blockId);
      byBlock.set(s.blockId, { blockId: s.blockId, name: s.name ?? '', durSec: lived, workSec: work });
    }
  }

  return {
    blocks: order
      .map((id) => byBlock.get(id)!)
      .filter((b) => b.workSec >= MIN_LIVED_SEC - 0.01)
      .map(({ blockId, name, durSec }) => ({ blockId, name, durSec })),
    segs,
  };
}
