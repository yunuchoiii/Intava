/**
 * 핸드오프 3장 — 구간 전개 규칙 · 총 소요 시간
 *
 * `LiveFlat.dc.html`의 build() 를 그대로 옮긴 것이다. 이 배열이 실행 화면,
 * 알림 예약, 완료 화면 통계, 편집 화면 합계의 유일한 출처다.
 */
import type { Preset, Segment } from '../types';

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
 * 주어진 차례대로 종목을 늘어놓는다.
 *
 * 실행 중에 편집 화면에서 종목이 추가·삭제될 수 있으므로 id를 곧이곧대로 믿지
 * 않는다. 없어진 id는 버리고, 차례에 없는 종목은 뒤에 붙인다 — 어떤 경우에도
 * 프리셋의 종목이 하나도 빠지지 않게 한다.
 */
function roundBlocks(p: Preset, ids: string[] | undefined) {
  if (!ids) return p.blocks;
  const picked = ids.map((id) => p.blocks.find((b) => b.id === id)).filter((b) => !!b);
  const rest = p.blocks.filter((b) => !picked.includes(b));
  return [...picked, ...rest];
}

export function buildPlan(p: Preset, orders?: RoundOrders): Plan {
  const segs: Segment[] = [];
  let t = 0;
  const B = p.blocks.length;

  if (p.warmupSec > 0) {
    segs.push({ phase: 'WARMUP', start: t, dur: p.warmupSec });
    t += p.warmupSec;
  }
  if (p.prepareSec > 0) {
    segs.push({ phase: 'PREPARE', start: t, dur: p.prepareSec });
    t += p.prepareSec;
  }

  for (let r = 1; r <= p.rounds; r++) {
    const blocks = roundBlocks(p, orders?.[r - 1]);
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
          if (!p.skipLastRest) {
            segs.push({ phase: 'SET_REST', ...meta, start: t, dur: bl.restSec });
            t += bl.restSec;
          }
        } else if (lastBlk) {
          segs.push({ phase: 'ROUND_REST', ...meta, start: t, dur: p.roundRestSec });
          t += p.roundRestSec;
        } else {
          segs.push({ phase: 'BLOCK_REST', ...meta, start: t, dur: p.blockRestSec });
          t += p.blockRestSec;
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
 * 실제로 해낸 만큼 — 완료 화면의 숫자.
 *
 * 끝까지 간 경우와 도중에 끈 경우가 같은 화면을 쓰므로, 계획이 아니라 흐른 시간을
 * 기준으로 센다. **끝난 구간만** 친다 — 20초짜리 운동을 3초 하다 껐으면 그 세트는
 * 하지 않은 것이다.
 */
export function progressAt(plan: Plan, elapsed: number) {
  const e = Math.max(0, Math.min(plan.total, elapsed));
  const done = plan.segs.filter((s) => s.phase === 'WORK' && s.start + s.dur <= e + 0.01);

  // 라운드는 그 안의 운동 구간이 **전부** 끝나야 완료다 — 하나라도 남았으면 직전까지만
  let lastRound = 0;
  let firstOpen = Number.POSITIVE_INFINITY;
  for (const s of plan.segs) {
    if (s.phase !== 'WORK' || s.round == null) continue;
    lastRound = Math.max(lastRound, s.round);
    if (s.start + s.dur > e + 0.01) firstOpen = Math.min(firstOpen, s.round);
  }

  return {
    elapsed: e,
    work: done.reduce((a, s) => a + s.dur, 0),
    sets: done.length,
    rounds: Number.isFinite(firstOpen) ? firstOpen - 1 : lastRound,
    full: e >= plan.total - 0.01,
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
