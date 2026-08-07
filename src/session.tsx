/**
 * 실행 세션 — 앱 전역에서 하나만 돈다.
 *
 * 예전에는 실행 화면 컴포넌트 안에 타이머가 살았다. 그래서 화면을 벗어나면
 * 타이머가 사라지고, OS가 앱을 정지시켰다 되살리면 예약해둔 알림만 계속 울리고
 * 정작 앱에는 아무것도 남아 있지 않았다.
 *
 * 이제 상태는 **절대 시각 두 개**뿐이다.
 *   zeroAt   — elapsed 0초에 해당하는 벽시계 시각
 *   pausedAt — 멈춘 시각(진행 중이면 null)
 *
 * 이 둘만 저장해두면 앱이 죽었다 살아나도 elapsed를 다시 계산할 수 있다.
 * 화면·컴포넌트가 아니라 시각이 진실이라, 며칠 뒤에 열어도 계산이 맞는다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { endSession, setCueVolume, startSession } from './audio';
import { buildPlan, segmentAt, type Plan } from './engine/segments';
import { countdownFeedback, segmentFeedback } from './feedback';
import { cancelAll, scheduleUpcoming } from './notify';
import { useStore } from './store';
import type { Preset, Segment } from './types';

const KEY = 'intava:session';

type Stored = {
  presetId: string;
  zeroAt: number;
  pausedAt: number | null;
};

export type RunSnapshot = {
  elapsed: number;
  seg: Segment | null;
  idx: number;
  remain: number;
  /** 남은 비율 0~1 — 링의 stroke-dashoffset 계산용 */
  ratio: number;
  paused: boolean;
  done: boolean;
};

export type Session = RunSnapshot & {
  /** 실행 중인 프리셋 — 없으면 세션이 없다 */
  preset: Preset | null;
  plan: Plan | null;
  total: number;
  next: Segment | undefined;
  /** 바로 앞 구간 — 왼쪽 버튼이 무엇으로 돌아가는지 적으려면 필요하다 */
  prev: Segment | undefined;
  /** 시간축이 끊긴 지점마다 증가 — 링 애니메이션이 기준을 다시 잡는 신호 */
  syncId: number;
  /**
   * 저장소에서 되살아난 세션인지 — 앱을 껐다 켠 경우에만 참이다.
   * 홈이 실행 화면을 자동으로 열지 말지 가르는 신호다. 방금 손으로 시작한 것까지
   * 되살아난 것으로 보면 화면이 두 번 밀린다.
   */
  restoredFromStorage: boolean;
  start: (presetId: string) => void;
  toggle: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  restart: () => void;
  stop: () => void;
  /** 링을 잡는 순간 — 값을 맞추는 동안 시간이 흐르면 손가락과 숫자가 서로 밀린다 */
  beginScrub: () => void;
  scrubRemain: (remainSec: number) => void;
  commitScrub: () => void;
};

const EMPTY: RunSnapshot = {
  elapsed: 0,
  seg: null,
  idx: 0,
  remain: 0,
  ratio: 1,
  paused: false,
  done: false,
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { presets, settings, markRun } = useStore();
  const [stored, setStored] = useState<Stored | null>(null);
  const [snap, setSnap] = useState<RunSnapshot>(EMPTY);
  const [syncId, setSyncId] = useState(0);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const storedRef = useRef<Stored | null>(null);
  storedRef.current = stored;

  const preset = useMemo(
    () => presets.find((p) => p.id === stored?.presetId) ?? null,
    [presets, stored?.presetId]
  );
  /** 프리셋 내용이 바뀌면 구간을 다시 편다 — 실행 중 편집을 위해 updatedAt까지 본다 */
  const plan = useMemo(() => (preset ? buildPlan(preset) : null), [preset]);
  const planRef = useRef(plan);
  planRef.current = plan;
  const presetRef = useRef(preset);
  presetRef.current = preset;

  // ── 저장 ────────────────────────────────────────────────────────────────

  const persist = useCallback((next: Stored | null) => {
    storedRef.current = next;
    setStored(next);
    if (next) void AsyncStorage.setItem(KEY, JSON.stringify(next));
    else void AsyncStorage.removeItem(KEY);
  }, []);

  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  /** 앱이 뜰 때 한 번 — 진행 중이던 세션을 되살린다 */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw || !alive) return;
        const s = JSON.parse(raw) as Stored;
        if (typeof s?.zeroAt !== 'number' || typeof s?.presetId !== 'string') return;
        storedRef.current = s;
        setStored(s);
        setRestoredFromStorage(true);
      } catch {
        // 읽기 실패는 세션이 없는 것으로 본다
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── 시간 계산 ───────────────────────────────────────────────────────────

  const elapsedNow = useCallback((): number => {
    const s = storedRef.current;
    const p = planRef.current;
    if (!s || !p) return 0;
    const at = s.pausedAt ?? Date.now();
    return Math.max(0, Math.min(p.total, (at - s.zeroAt) / 1000));
  }, []);

  const snapshotAt = useCallback((elapsed: number): RunSnapshot => {
    const p = planRef.current;
    const paused = storedRef.current?.pausedAt != null;
    if (!p) return EMPTY;
    const found = segmentAt(p, elapsed);
    if (!found) {
      return { elapsed: p.total, seg: null, idx: p.segs.length, remain: 0, ratio: 1, paused, done: true };
    }
    const remain = found.seg.start + found.seg.dur - elapsed;
    return {
      elapsed,
      seg: found.seg,
      idx: found.idx,
      remain,
      ratio: Math.max(0, Math.min(1, remain / found.seg.dur)),
      paused,
      done: false,
    };
  }, []);

  // ── 알림 예약 ───────────────────────────────────────────────────────────

  /**
   * 예약은 항상 "전부 취소 후 다시"인데, 취소가 비동기라 두 번이 겹치면
   * 앞의 예약이 취소 뒤에 되살아나 **같은 알림이 두 번** 뜬다.
   * 토큰으로 최신 요청만 살아남게 한다.
   */
  const scheduleToken = useRef(0);
  const reschedule = useCallback(async () => {
    const token = ++scheduleToken.current;
    const s = storedRef.current;
    const p = planRef.current;
    const preset = presetRef.current;
    await cancelAll();
    if (token !== scheduleToken.current) return;
    if (!s || !p || !preset || s.pausedAt != null) return;

    const e = elapsedNow();
    if (e >= p.total) return;
    await scheduleUpcoming({
      plan: p,
      preset,
      zeroAt: s.zeroAt,
      elapsed: e,
      sound: settingsRef.current.sound,
      vibration: settingsRef.current.vibration,
      enabled: settingsRef.current.notifications,
      isCurrent: () => token === scheduleToken.current,
    });
  }, [elapsedNow]);

  // ── 째깍임 ──────────────────────────────────────────────────────────────

  const lastIdx = useRef(-1);
  const lastTick = useRef('');
  const doneFired = useRef(false);
  /** 드래그하느라 우리가 멈춘 것인지 — 사용자가 멈춰둔 것과 구분해야 한다 */
  const autoPaused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  /**
   * 고정 간격으로 돌지 않는다. **다음 초 경계**에 정확히 깨어나도록 매번
   * 다시 계산해서 예약한다 — 250ms 간격으로 훑으면 숫자가 바뀌는 시점과
   * 알림음이 최대 250ms까지 흔들린다. Date.now() 기준이라 오차도 쌓이지 않는다.
   */
  const tick = useCallback(() => {
    const p = planRef.current;
    const s = storedRef.current;
    if (!p || !s) return;

    const e = elapsedNow();
    const shot = snapshotAt(e);
    setSnap(shot);

    if (s.pausedAt != null) return;

    if (shot.done) {
      if (!doneFired.current) {
        doneFired.current = true;
        segmentFeedback('DONE', settingsRef.current);
      }
      return;
    }

    if (shot.idx !== lastIdx.current) {
      lastIdx.current = shot.idx;
      lastTick.current = '';
      segmentFeedback(shot.seg!.phase, settingsRef.current);
    }

    // 각 구간 마지막 3초 — 3, 2, 1에 한 번씩
    const left = Math.ceil(shot.remain - 0.001);
    if (left <= 3 && left >= 1) {
      const key = `${shot.idx}:${left}`;
      if (lastTick.current !== key) {
        lastTick.current = key;
        countdownFeedback(settingsRef.current);
      }
    }

    // 다음 초 경계까지 남은 시간만큼만 잔다
    const frac = shot.remain - Math.floor(shot.remain);
    const waitMs = Math.max(20, (frac > 0.02 ? frac : 1) * 1000);
    clearTimer();
    timer.current = setTimeout(tick, waitMs);
  }, [elapsedNow, snapshotAt]);

  /**
   * 세션이 살아 있는 동안만 — 오디오 세션도 여기서 잡는다(화면이 아니라 세션이 기준).
   *
   * 의존성은 **세션의 정체(어떤 프리셋이냐)** 이지 상태 전체가 아니다.
   * 전체를 걸면 일시정지·재개·점프 때마다 "이 구간을 처음 본다"로 초기화돼서
   * 재개하는 순간 현재 구간의 시작음이 다시 울린다.
   */
  const sessionId = stored?.presetId ?? null;
  useEffect(() => {
    if (!sessionId || !planRef.current) {
      clearTimer();
      setSnap(EMPTY);
      return;
    }
    void startSession(settingsRef.current.volume);
    lastIdx.current = -1;
    lastTick.current = '';
    doneFired.current = elapsedNow() >= planRef.current.total;
    tick();
    void reschedule();
    return clearTimer;
  }, [sessionId, tick, reschedule, elapsedNow]);

  /** 프리셋 내용이 바뀌면(실행 중 편집) 구간만 다시 계산해 그린다 — 안내음은 다시 울리지 않는다 */
  useEffect(() => {
    if (!sessionId) return;
    tick();
    void reschedule();
  }, [plan, sessionId, tick, reschedule]);

  /** 세션이 끝나면 오디오 세션을 놓아준다 */
  useEffect(() => {
    if (stored) return;
    endSession();
    void cancelAll();
  }, [stored]);

  useEffect(() => {
    setCueVolume(settings.volume);
  }, [settings.volume]);

  /** 백그라운드에 다녀오면 다시 계산하고 알림을 다시 채운다 (iOS 64개 제한) */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!storedRef.current) return;
      if (state === 'active') {
        setSyncId((n) => n + 1);
        tick();
        void reschedule();
      } else if (state === 'background') {
        void reschedule();
      }
    });
    return () => sub.remove();
  }, [tick, reschedule]);

  // ── 조작 ────────────────────────────────────────────────────────────────

  const seekTo = useCallback(
    (sec: number, announce: boolean, replan = true) => {
      const s = storedRef.current;
      const p = planRef.current;
      if (!s || !p) return;
      const clamped = Math.max(0, Math.min(p.total, sec));
      const next: Stored = {
        ...s,
        zeroAt: (s.pausedAt ?? Date.now()) - clamped * 1000,
      };
      persist(next);
      if (clamped < p.total) doneFired.current = false;
      if (!announce) {
        const shot = snapshotAt(clamped);
        lastIdx.current = shot.idx;
        lastTick.current = '';
      }
      setSyncId((n) => n + 1);
      tick();
      if (replan) void reschedule();
    },
    [persist, snapshotAt, tick, reschedule]
  );

  const value = useMemo<Session>(() => {
    const controls = {
      start: (presetId: string) => {
        lastIdx.current = -1;
        lastTick.current = '';
        doneFired.current = false;
        markRun(presetId);
        persist({ presetId, zeroAt: Date.now(), pausedAt: null });
        setSyncId((n) => n + 1);
      },
      toggle: () => {
        const s = storedRef.current;
        if (!s) return;
        if (s.pausedAt != null) {
          // 재개 — 멈춰 있던 만큼 기준 시각을 뒤로 민다
          const paused = Date.now() - s.pausedAt;
          persist({ ...s, zeroAt: s.zeroAt + paused, pausedAt: null });
          lastIdx.current = snapshotAt(elapsedNow()).idx;
          lastTick.current = '';
        } else {
          persist({ ...s, pausedAt: Date.now() });
        }
        setSyncId((n) => n + 1);
        tick();
        void reschedule();
      },
      skipNext: () => {
        const p = planRef.current;
        if (!p) return;
        const found = segmentAt(p, elapsedNow());
        const nextSeg = found ? p.segs[found.idx + 1] : undefined;
        seekTo(nextSeg ? nextSeg.start + 0.01 : p.total, storedRef.current?.pausedAt == null);
      },
      skipPrev: () => {
        const p = planRef.current;
        if (!p) return;
        const e = elapsedNow();
        const found = segmentAt(p, e);
        if (!found) {
          const last = p.segs[p.segs.length - 1];
          seekTo(last ? last.start : 0, false);
          return;
        }
        if (e - found.seg.start > 1.2) {
          seekTo(found.seg.start, false);
          return;
        }
        const prev = p.segs[found.idx - 1];
        seekTo(prev ? prev.start : 0, false);
      },
      restart: () => {
        doneFired.current = false;
        lastIdx.current = -1;
        const s = storedRef.current;
        if (s) persist({ ...s, zeroAt: Date.now(), pausedAt: null });
        setSyncId((n) => n + 1);
        tick();
        void reschedule();
      },
      stop: () => {
        clearTimer();
        persist(null);
        setSnap(EMPTY);
      },
      beginScrub: () => {
        const s = storedRef.current;
        if (!s || s.pausedAt != null) {
          // 이미 멈춰 있었다면 드래그가 끝나도 그대로 둔다
          autoPaused.current = false;
          return;
        }
        autoPaused.current = true;
        persist({ ...s, pausedAt: Date.now() });
        setSyncId((n) => n + 1);
        void reschedule();
      },
      scrubRemain: (remainSec: number) => {
        const p = planRef.current;
        if (!p) return;
        const found = segmentAt(p, elapsedNow());
        if (!found) return;
        const { seg } = found;
        const clamped = Math.max(0.05, Math.min(seg.dur, remainSec));
        seekTo(seg.start + seg.dur - clamped, false, false);
      },
      commitScrub: () => {
        const s = storedRef.current;
        if (autoPaused.current && s?.pausedAt != null) {
          // 멈춰 있던 만큼 기준 시각을 뒤로 밀어 이어서 흐르게 한다
          persist({ ...s, zeroAt: s.zeroAt + (Date.now() - s.pausedAt), pausedAt: null });
          lastIdx.current = snapshotAt(elapsedNow()).idx;
          lastTick.current = '';
        }
        autoPaused.current = false;
        setSyncId((n) => n + 1);
        tick();
        void reschedule();
      },
    };

    return {
      ...snap,
      preset,
      plan,
      total: plan?.total ?? 0,
      next: plan?.segs[snap.idx + 1],
      prev: snap.idx > 0 ? plan?.segs[snap.idx - 1] : undefined,
      syncId,
      restoredFromStorage,
      ...controls,
    };
  }, [snap, preset, plan, syncId, restoredFromStorage, persist, seekTo, tick, reschedule, elapsedNow, snapshotAt, markRun]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession called outside SessionProvider');
  return v;
}
