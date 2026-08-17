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
import { endSession, resumeSession, setCueVolume, setDuckMusic, startSession } from './audio';
import {
  advanceLived,
  buildPlan,
  livedSpans,
  segmentAt,
  summarizeLived,
  NO_LIVED,
  type Lived,
  type Plan,
  type RoundOrders,
  type RoundSkips,
} from './engine/segments';
import { blockSummary, shapeLabel } from './engine/labels';
import { countdownFeedback, segmentFeedback } from './feedback';
import { cancelAll, scheduleUpcoming } from './notify';
import { uid, useStore } from './store';
import type { Preset, Segment } from './types';

const KEY = 'intava:session';

type Stored = {
  presetId: string;
  zeroAt: number;
  /**
   * 진짜로 시작한 벽시계 시각 — 기록의 "오전 7:18 시작"이 이것이다.
   *
   * zeroAt은 쓸 수 없다. 그것은 elapsed 0에 해당하는 시각이라 멈출 때마다
   * 뒤로 밀린다 — 10분 쉬었다 재개하면 시작이 10분 늦은 것으로 적힌다.
   */
  startedAt?: number;
  pausedAt: number | null;
  /**
   * 실행 중에 바꾼 종목 차례 — 라운드별로 따로 둔다. 없으면 프리셋에 적힌 대로.
   *
   * 스토어의 프리셋을 고치지 않는 이유: 계획은 프리셋에서 매번 다시 펴는데,
   * 종목 배열을 바꾸면 **이미 지나간 자리까지** 다시 펴져서 흐른 시간이 엉뚱한
   * 구간을 가리키게 된다. 이 차례는 이 실행에만 살고, 루틴에 남길지는 완료
   * 화면에서 따로 묻는다.
   */
  orders?: RoundOrders;
  /**
   * 실행 중에 빼기로 한 종목 — 라운드별. orders와 같은 이유로 라운드별이다.
   *
   * 지금 라운드에서 **이미 지나간 종목은 여기 들어오지 않는다.** 지나간 배치가
   * 바뀌면 흐른 시간이 가리키는 구간이 어긋난다 — 순서를 못 옮기게 한 것과 같은
   * 이유이고, 그래서 시트도 굳은 행의 체크박스를 잠근다.
   */
  skips?: RoundSkips;
  /** 실제로 지나온 몫 — 넘긴 구간은 빠진다 */
  lived?: Lived;
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
  /** 이번 실행의 종목 차례 — 라운드별. 손대지 않았으면 비어 있다 */
  orders: RoundOrders | undefined;
  /** 이번 실행에서 뺀 종목 — 라운드별. 손대지 않았으면 비어 있다 */
  skips: RoundSkips | undefined;
  /**
   * 지금 라운드의 차례(종목 id) — 순서 시트가 보여주는 목록.
   * 뺀 종목도 여기 그대로 있다. 목록에서 사라지면 다시 넣을 자리가 없다.
   */
  roundOrder: string[];
  /** 그중 지금 라운드에서 빠진 것 — 시트의 체크가 꺼진 행 */
  roundSkips: string[];
  /** 앞에서 몇 개가 이미 지났는지 — 여기까지는 옮길 수도, 뺄 수도 없다 */
  lockedCount: number;
  /**
   * 남은 차례를 새로 정한다. ids는 지금 라운드의 **전체** 차례이고,
   * 앞의 lockedCount개는 그대로여야 한다. 다음 라운드부터도 이 차례를 따른다.
   */
  reorder: (ids: string[]) => void;
  /**
   * 뺄 종목을 새로 정한다. ids는 지금 라운드에서 **빼는 것 전체**이고,
   * 앞의 lockedCount개는 들어올 수 없다. 다음 라운드부터도 이대로 빠진다.
   */
  setSkipped: (ids: string[]) => void;
  /**
   * 지금까지 지나온 몫을 셈에 반영하고 돌려준다 — 완료 화면으로 넘길 숫자다.
   * 매 초 적어두면 저장이 너무 잦아서, 끝내는 순간에 한 번 정산한다.
   *
   * 방금 남긴 기록의 id도 함께 준다. 이 함수는 이미 종목별 몫과 구간 이력을
   * 다 계산해서 기록에 넣고 있는데, 예전에는 숫자 다섯 개만 돌려주는 바람에
   * 완료 화면이 그 나머지를 볼 길이 없었다. 큰 JSON을 라우터 파라미터에 싣는
   * 대신 id만 넘기고 완료 화면이 저장소에서 꺼내 보게 한다.
   */
  settle: () => { lived: Lived; recordId?: string };
  start: (presetId: string, orders?: RoundOrders, skips?: RoundSkips) => void;
  toggle: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  /**
   * 지금 하는 종목을 통째로 넘긴다 — 남은 세트를 건너뛰고 그 뒤 휴식으로 간다.
   * 넘길 종목이 없는 자리(웜업·준비·쿨다운, 이미 휴식 중)에서는 아무 일도 없다.
   */
  skipBlock: () => void;
  /** 지금 종목을 넘길 수 있는 자리인가 — 버튼을 흐리게 둘지 정한다 */
  canSkipBlock: boolean;
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
  const { presets, settings, markRun, addRecord } = useStore();
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
  const plan = useMemo(
    () => (preset ? buildPlan(preset, stored?.orders, stored?.skips) : null),
    [preset, stored?.orders, stored?.skips]
  );
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
  /** 이 실행을 이미 기록했는가 — 한 실행에 한 건만 남긴다 */
  const recorded = useRef(false);
  /** 그때 남긴 기록의 id — 완료 화면이 저장소에서 꺼내 볼 열쇠다 */
  const recordedId = useRef<string | undefined>(undefined);
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

  useEffect(() => {
    setDuckMusic(settings.duckMusic);
  }, [settings.duckMusic]);

  /** 백그라운드에 다녀오면 다시 계산하고 알림을 다시 채운다 (iOS 64개 제한) */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!storedRef.current) return;
      if (state === 'active') {
        // 전화·알람이 끼어들면 무음 루프가 멎은 채 남는다 — 살아 있는지 보고 되살린다
        resumeSession();
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
      /*
        뛰기 전까지 흘러온 몫을 먼저 셈에 넣고, 센 자리를 도착점으로 옮긴다 —
        건너뛴 구간은 그 사이로 빠져 영영 세지 않는다. 뒤로 갈 때는 자리를
        되돌리지 않는다. 같은 세트를 두 번 세지 않으려는 것이다.
      */
      const lived = advanceLived(s.lived, p, elapsedNow());
      const next: Stored = {
        ...s,
        zeroAt: (s.pausedAt ?? Date.now()) - clamped * 1000,
        lived: { ...lived, at: Math.max(lived.at, clamped) },
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
    [persist, snapshotAt, tick, reschedule, elapsedNow]
  );

  const value = useMemo<Session>(() => {
    /**
     * 지금 손댈 수 있는 라운드와, 그 안에서 이미 굳은 앞자리 수.
     *
     * 굳는 기준은 "지나갔는가"다. 하고 있는 종목까지가 굳고 그 뒤가 열린다.
     * 라운드 사이 휴식에서는 이번 라운드가 통째로 끝난 뒤이므로 **다음 라운드**를
     * 열어준다 — 그 자리에서 다음 판의 차례를 짜는 것이 자연스럽다.
     */
    const edit = (() => {
      const natural = preset?.blocks.map((b) => b.id) ?? [];
      const orderOf = (round: number) => stored?.orders?.[round - 1] ?? natural;
      const skipOf = (round: number) => stored?.skips?.[round - 1] ?? [];
      const at = (round: number, locked: number) => ({
        round,
        locked,
        order: orderOf(round),
        skip: skipOf(round),
      });
      const seg = snap.seg;
      if (!preset || !seg) return at(1, natural.length);
      switch (seg.phase) {
        case 'WARMUP':
        case 'PREPARE':
          return at(1, 0);
        case 'WORK':
        case 'SET_REST':
        case 'BLOCK_REST': {
          const round = seg.round ?? 1;
          /*
            굳은 자리는 seg.blk로 셀 수 없다. blk은 **실제로 도는 목록**에서 몇
            번째냐인데, 시트가 보여주는 목록은 뺀 종목까지 들고 있어서 빼기가
            하나라도 있으면 두 자리가 어긋난다. 정체(blockId)로 되짚는다.
          */
          const order = orderOf(round);
          const pos = seg.blockId ? order.indexOf(seg.blockId) : -1;
          /*
            차례에 없는 종목을 돌고 있을 수 있다 — 실행 중에 편집 화면에서 종목을
            더하면 계획에는 라운드 끝에 붙지만 이 차례에는 없다. 그때는 통째로
            잠근다. 시트에 보이는 것은 전부 그 앞의 종목이라 이미 다 지난 것이다.
          */
          return {
            round,
            locked: pos >= 0 ? pos + 1 : order.length,
            order,
            skip: skipOf(round),
          };
        }
        case 'ROUND_REST': {
          const next = Math.min(preset.rounds, (seg.round ?? 1) + 1);
          return at(next, 0);
        }
        default:
          // 쿨다운 — 종목은 다 끝났다
          return at(preset.rounds, natural.length);
      }
    })();

    const controls = {
      start: (presetId: string, orders?: RoundOrders, skips?: RoundSkips) => {
        lastIdx.current = -1;
        lastTick.current = '';
        doneFired.current = false;
        recorded.current = false;
        recordedId.current = undefined;
        markRun(presetId);
        // 완료 화면의 "다시 하기"는 방금 돌던 구성을 그대로 물려받는다 — 차례도, 뺀 것도
        const now = Date.now();
        persist({ presetId, zeroAt: now, startedAt: now, pausedAt: null, orders, skips });
        setSyncId((n) => n + 1);
      },
      /**
       * 남은 차례를 바꾼다 — 시간은 건드리지 않는다.
       *
       * 지금 라운드의 앞부분(이미 지난 종목 + 지금 하는 종목)이 그대로면 흐른 시간이
       * 가리키는 구간도 그대로다. 그 뒤만 다시 펴진다. 알림은 앞으로의 일이라
       * 전부 다시 예약한다.
       */
      reorder: (ids: string[]) => {
        const s = storedRef.current;
        const p = presetRef.current;
        if (!s || !p) return;
        const natural = p.blocks.map((b) => b.id);
        const next: RoundOrders = [];
        for (let r = 1; r <= p.rounds; r++) {
          next[r - 1] = r < edit.round ? (s.orders?.[r - 1] ?? natural) : ids;
        }
        persist({ ...s, orders: next });
        setSyncId((n) => n + 1);
        void reschedule();
      },
      /**
       * 뺄 종목을 바꾼다 — 순서와 같은 규칙이다. 지나간 라운드는 그대로 두고
       * 손댈 수 있는 라운드부터 새 목록을 쓴다.
       *
       * 지금 라운드에서 이미 지나간 종목은 ids에 들어오지 않는다(시트가 굳은 행의
       * 체크박스를 잠근다). 들어오면 지나간 배치가 바뀌어 흐른 시간이 엉뚱한
       * 구간을 가리키게 되므로, 여기서 한 겹 더 걸러 앞자리를 지킨다.
       */
      setSkipped: (ids: string[]) => {
        const s = storedRef.current;
        const p = presetRef.current;
        if (!s || !p) return;
        const head = edit.order.slice(0, edit.locked);
        const frozen = new Set(head);
        const wasSkipped = new Set(edit.skip);
        const safe = [
          // 굳은 자리는 지금 상태 그대로 — 새로 빼지도, 도로 넣지도 않는다.
          // 통째로 걸러내면 앞서 빼둔 종목이 다음 라운드에 되살아난다.
          ...head.filter((id) => wasSkipped.has(id)),
          ...ids.filter((id) => !frozen.has(id)),
        ];
        const next: RoundSkips = [];
        for (let r = 1; r <= p.rounds; r++) {
          next[r - 1] = r < edit.round ? (s.skips?.[r - 1] ?? []) : safe;
        }
        persist({ ...s, skips: next });
        setSyncId((n) => n + 1);
        void reschedule();
      },
      /**
       * 정산하고 **기록을 한 건 남긴다** — 완료 화면으로 떠나는 길목이다.
       *
       * 여기서 남기는 이유: 이 순간이 완주와 중단이 모두 지나는 유일한 자리이고,
       * 아직 세션이 살아 있어 계획·시작 시각·지나온 몫을 다 알고 있다. 완료
       * 화면은 뜨자마자 세션을 비우므로 그 뒤에는 물어볼 데가 없다.
       *
       * **한 실행에 한 건이다.** 같은 세션에서 두 번 불려도 두 번 적지 않는다.
       */
      settle: () => {
        const s = storedRef.current;
        const p = planRef.current;
        const preset = presetRef.current;
        if (!s || !p) return { lived: NO_LIVED };
        const lived = advanceLived(s.lived, p, elapsedNow());
        persist({ ...s, lived });

        if (preset && !recorded.current) {
          recorded.current = true;
          const recordId = uid();
          recordedId.current = recordId;
          // at 하나가 아니라 실제로 지나온 구간들로 센다 — 넘긴 종목은 여기서 빠진다
          const { blocks, segs } = summarizeLived(p, livedSpans(lived));
          const specOf = new Map(
            preset.blocks.map((b) => [b.id, blockSummary(b.workSec, b.restSec, b.sets)])
          );
          addRecord({
            id: recordId,
            presetId: preset.id,
            presetName: preset.name,
            startedAt: s.startedAt ?? s.zeroAt,
            endedAt: Date.now(),
            totalSec: Math.round(lived.total),
            workSec: Math.round(lived.work),
            completedSets: lived.sets,
            completed: lived.at >= p.total - 0.01,
            shape: shapeLabel(preset),
            blocks: blocks.map((b) => ({
              name: b.name,
              spec: specOf.get(b.blockId) ?? '',
              durSec: Math.round(b.durSec),
            })),
            segs: segs.map((x) => ({ phase: x.phase, durSec: x.durSec })),
          });
        }
        // 두 번 불려도 같은 기록을 가리킨다 — 완료 화면이 뒤늦게 물어도 답이 있다
        return { lived, recordId: recordedId.current };
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
      /**
       * 지금 하는 종목을 통째로 넘긴다.
       *
       * `buildPlan`은 한 종목의 세그먼트를 연속으로 펼치고, 뒤따르는 휴식들이 방금
       * 끝낸 세트의 meta(round·blockId)를 그대로 물려받는다. 그래서 규칙 하나로
       * 족하다 — **같은 종목의 운동·세트휴식인 동안 건너뛰고, 처음 만나는 그 밖의
       * 자리가 도착점이다.** 이 한 줄이 경계를 전부 흡수한다:
       *
       *   보통                     → 그 종목의 BLOCK_REST
       *   라운드의 마지막 종목      → ROUND_REST
       *   마지막 라운드의 마지막    → COOLDOWN, 없으면 완료
       *   종목 사이 휴식이 0초     → BLOCK_REST 자체가 없으니 다음 종목의 첫 WORK
       */
      skipBlock: () => {
        const p = planRef.current;
        if (!p) return;
        const found = segmentAt(p, elapsedNow());
        if (!found) return;
        const { seg, idx } = found;
        // 웜업·준비·쿨다운에는 넘길 종목이 없고, 휴식은 이미 그 종목을 지난 뒤다
        if (!seg.blockId || (seg.phase !== 'WORK' && seg.phase !== 'SET_REST')) return;

        let i = idx;
        while (i < p.segs.length) {
          const s = p.segs[i];
          const mine =
            s.blockId === seg.blockId &&
            s.round === seg.round &&
            (s.phase === 'WORK' || s.phase === 'SET_REST');
          if (!mine) break;
          i += 1;
        }
        const target = p.segs[i];
        seekTo(target ? target.start + 0.01 : p.total, storedRef.current?.pausedAt == null);
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
        // 처음부터 다시 도는 것이니 지나온 셈도 처음으로 되돌린다
        if (s) persist({ ...s, zeroAt: Date.now(), pausedAt: null, lived: NO_LIVED });
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
      // 종목에 속한 자리에서만 넘길 것이 남아 있다 — skipBlock의 문지기와 같은 조건
      canSkipBlock:
        !!snap.seg?.blockId && (snap.seg.phase === 'WORK' || snap.seg.phase === 'SET_REST'),
      syncId,
      restoredFromStorage,
      orders: stored?.orders,
      skips: stored?.skips,
      roundOrder: edit.order,
      roundSkips: edit.skip,
      lockedCount: edit.locked,
      ...controls,
    };
  }, [snap, preset, plan, syncId, restoredFromStorage, stored?.orders, stored?.skips, persist, seekTo, tick, reschedule, elapsedNow, snapshotAt, markRun, addRecord]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession called outside SessionProvider');
  return v;
}
