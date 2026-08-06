/**
 * 핸드오프 3장 「타이밍 방식」 — 구현의 핵심
 *
 * setInterval로 1초씩 빼지 않는다. 절대 시각 기반 스케줄만 쓴다.
 *   elapsed = now - startedAt - 누적 일시정지 시간
 * 화면 갱신은 250ms 인터벌이지만 값 자체는 Date.now() 기반이라 인터벌이
 * 지연돼도 오차가 누적되지 않고, 백그라운드에 다녀와 여러 구간을 건너뛴
 * 경우까지 자동으로 복구된다. requestAnimationFrame은 쓰지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { buildPlan, segmentAt, type Plan } from './segments';
import { countdownFeedback, segmentFeedback } from '../feedback';
import { cancelAll, scheduleUpcoming } from '../notify';
import type { Preset, Segment, Settings } from '../types';

const TICK_MS = 250;

export type RunSnapshot = {
  elapsed: number;
  /** 전체가 끝났으면 null */
  seg: Segment | null;
  idx: number;
  remain: number;
  /** 남은 비율 0~1 — 링의 stroke-dashoffset 계산용 */
  ratio: number;
  paused: boolean;
  done: boolean;
};

export type Runner = RunSnapshot & {
  plan: Plan;
  total: number;
  next: Segment | undefined;
  /** 시간축이 끊긴 지점마다 증가한다 — 링 애니메이션이 다시 기준을 잡는 신호 */
  syncId: number;
  toggle: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  restart: () => void;
  stop: () => void;
  /** 링을 드래그하는 동안 — 알림 재예약 없이 현재 구간 안에서만 위치를 옮긴다 */
  scrubRemain: (remainSec: number) => void;
  /** 드래그가 끝난 뒤 한 번만 알림을 다시 예약한다 */
  commitScrub: () => void;
};

export function useRunner(preset: Preset, settings: Settings, onDone: () => void): Runner {
  const plan = useMemo(() => buildPlan(preset), [preset]);

  const base = useRef(0); // 고정된 elapsed
  const wall = useRef(Date.now()); // 그 시점의 wall clock
  const paused = useRef(false);
  const lastIdx = useRef(-1);
  const lastTick = useRef('');
  const doneFired = useRef(false);
  const stopped = useRef(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const read = useCallback((): number => {
    const t = paused.current ? base.current : base.current + (Date.now() - wall.current) / 1000;
    return Math.max(0, Math.min(plan.total, t));
  }, [plan.total]);

  const snapshot = useCallback(
    (elapsed: number): RunSnapshot => {
      const found = segmentAt(plan, elapsed);
      if (!found) {
        return {
          elapsed: plan.total,
          seg: null,
          idx: plan.segs.length,
          remain: 0,
          ratio: 1,
          paused: paused.current,
          done: true,
        };
      }
      const remain = found.seg.start + found.seg.dur - elapsed;
      return {
        elapsed,
        seg: found.seg,
        idx: found.idx,
        remain,
        ratio: Math.max(0, Math.min(1, remain / found.seg.dur)),
        paused: paused.current,
        done: false,
      };
    },
    [plan]
  );

  const [snap, setSnap] = useState<RunSnapshot>(() => snapshot(0));
  const [syncId, setSyncId] = useState(0);
  const resync = useCallback(() => setSyncId((n) => n + 1), []);

  const reschedule = useCallback(() => {
    if (stopped.current) return;
    const e = read();
    if (paused.current || e >= plan.total) {
      void cancelAll();
      return;
    }
    void scheduleUpcoming({
      plan,
      preset,
      zeroAt: Date.now() - e * 1000,
      elapsed: e,
      sound: settingsRef.current.sound,
      vibration: settingsRef.current.vibration,
    });
  }, [plan, preset, read]);

  /** 250ms 인터벌 — 값 계산 + 구간 전환 감지 */
  useEffect(() => {
    const step = () => {
      if (stopped.current) return;
      const e = read();
      const s = snapshot(e);
      setSnap(s);

      if (paused.current) return;

      if (s.done) {
        if (!doneFired.current) {
          doneFired.current = true;
          segmentFeedback('DONE', settingsRef.current);
          onDone();
        }
        return;
      }

      if (s.idx !== lastIdx.current) {
        lastIdx.current = s.idx;
        lastTick.current = '';
        segmentFeedback(s.seg!.phase, settingsRef.current);
      }

      // 각 구간 마지막 3초 — 3, 2, 1에 한 번씩
      const left = Math.ceil(s.remain);
      if (left <= 3 && left >= 1) {
        const key = `${s.idx}:${left}`;
        if (lastTick.current !== key) {
          lastTick.current = key;
          countdownFeedback(settingsRef.current);
        }
      }
    };

    step();
    const id = setInterval(step, TICK_MS);
    return () => clearInterval(id);
  }, [read, snapshot, onDone]);

  /** 시작 시 한 번 예약 */
  useEffect(() => {
    reschedule();
  }, [reschedule]);

  /** 화면을 벗어나면 타이머와 예약을 함께 정리한다 */
  useEffect(
    () => () => {
      stopped.current = true;
      void cancelAll();
    },
    []
  );

  /** 백그라운드에 다녀오면 다시 계산하고 알림을 다시 채운다 (iOS 64개 제한) */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setSnap(snapshot(read()));
        resync(); // 돌아온 시점에 링 애니메이션을 다시 맞춘다
        reschedule();
      } else if (state === 'background') {
        reschedule();
      }
    });
    return () => sub.remove();
  }, [read, snapshot, reschedule, resync]);

  const seek = useCallback(
    (sec: number, announce: boolean, replan = true) => {
      base.current = Math.max(0, Math.min(plan.total, sec));
      wall.current = Date.now();
      if (base.current < plan.total) doneFired.current = false;
      const s = snapshot(read());
      if (!announce) {
        lastIdx.current = s.idx;
        lastTick.current = '';
      }
      setSnap(s);
      resync();
      if (replan) reschedule();
    },
    [plan.total, read, snapshot, reschedule, resync]
  );

  /** 링 드래그 — 현재 구간 안에서 남은 시간을 직접 잡는다 */
  const scrubRemain = useCallback(
    (remainSec: number) => {
      const found = segmentAt(plan, read());
      if (!found) return;
      const { seg } = found;
      const clamped = Math.max(0.05, Math.min(seg.dur, remainSec));
      // 알림 재예약은 드래그가 끝난 뒤 한 번만 — 매 프레임 예약하면 감당이 안 된다
      seek(seg.start + seg.dur - clamped, false, false);
    },
    [plan, read, seek]
  );

  const commitScrub = useCallback(() => reschedule(), [reschedule]);

  const toggle = useCallback(() => {
    const e = read();
    base.current = e;
    wall.current = Date.now();
    paused.current = !paused.current;
    if (!paused.current) {
      // 재개 — 같은 구간을 다시 알리지 않는다
      lastIdx.current = snapshot(e).idx;
      lastTick.current = '';
    }
    setSnap(snapshot(e));
    resync();
    reschedule();
  }, [read, snapshot, reschedule, resync]);

  const skipNext = useCallback(() => {
    const e = read();
    const found = segmentAt(plan, e);
    const nextSeg = found ? plan.segs[found.idx + 1] : undefined;
    seek(nextSeg ? nextSeg.start + 0.01 : plan.total, !paused.current);
  }, [plan, read, seek]);

  /** 현재 구간 경과 > 1.2초면 현재 구간 처음으로, 이내면 이전 구간 처음으로 */
  const skipPrev = useCallback(() => {
    const e = read();
    const found = segmentAt(plan, e);
    if (!found) {
      const last = plan.segs[plan.segs.length - 1];
      seek(last ? last.start : 0, false);
      return;
    }
    if (e - found.seg.start > 1.2) {
      seek(found.seg.start, false);
      return;
    }
    const prev = plan.segs[found.idx - 1];
    seek(prev ? prev.start : 0, false);
  }, [plan, read, seek]);

  const restart = useCallback(() => {
    doneFired.current = false;
    paused.current = false;
    lastIdx.current = -1; // 첫 구간 안내음을 다시 울린다
    seek(0, true);
  }, [seek]);

  const stop = useCallback(() => {
    stopped.current = true;
    void cancelAll();
  }, []);

  return {
    ...snap,
    plan,
    total: plan.total,
    next: plan.segs[snap.idx + 1],
    syncId,
    scrubRemain,
    commitScrub,
    toggle,
    skipNext,
    skipPrev,
    restart,
    stop,
  };
}
