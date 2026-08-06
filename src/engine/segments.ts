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

export function buildPlan(p: Preset): Plan {
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
    for (let b = 0; b < B; b++) {
      const bl = p.blocks[b];
      for (let s = 1; s <= bl.sets; s++) {
        const meta = { round: r, blk: b, set: s, sets: bl.sets, name: bl.name };
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

/** offset(초)이 속한 구간. 전체가 끝났으면 null */
export function segmentAt(plan: Plan, elapsed: number): { seg: Segment; idx: number } | null {
  for (let i = 0; i < plan.segs.length; i++) {
    const s = plan.segs[i];
    if (elapsed < s.start + s.dur) return { seg: s, idx: i };
  }
  return null;
}
