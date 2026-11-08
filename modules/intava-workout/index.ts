/**
 * 운동 세션 · 건강 기록 — iOS는 HealthKit(ios/IntavaWorkoutModule.swift), 안드로이드는 헬스 커넥트
 * (android/…/IntavaWorkoutModule.kt). 안드로이드에는 운동 세션이 없어 start/stop이 "none"을 돌려주고,
 * 세션이 끝나면 시작 · 끝 시각으로 한 건 써넣는다(saveWorkoutRecord).
 *
 * 네이티브 모듈이 없는 빌드(Expo Go)에서는 조용히 아무것도 하지 않는다 — 운동 세션은 아일랜드와
 * 건강 기록을 거드는 덤이고, 타이머는 그것 없이 돈다.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WorkoutType } from '../../src/types';

type Native = {
  authorizationStatus(): number;
  requestAuthorization(): Promise<string>;
  start(type: string): Promise<string>;
  pause(): void;
  resume(): void;
  stop(save: boolean): Promise<string>;
  saveWorkout(type: string, startMs: number, endMs: number): Promise<string>;
  state(): number;
  // 안드로이드만
  openHealthConnect?(): boolean;
  hasSamsungHealth?(): boolean;
  openSamsungHealth?(): boolean;
};

const native = requireOptionalNativeModule<Native>('IntavaWorkout');

let pendingAuth: Promise<string> | null = null;

/** 권한을 묻는다 — 이미 답했으면 창 없이 지나간다. 동시에 두 번 묻지 않는다 */
export function requestWorkoutAuthorization(): Promise<string> {
  if (!native) return Promise.resolve('missing');
  if (!pendingAuth) {
    pendingAuth = native
      .requestAuthorization()
      .catch((e: unknown) => `throw ${String(e)}`)
      .finally(() => {
        pendingAuth = null;
      });
  }
  return pendingAuth;
}

/** 권한 창이 뜰 차례인가 — 아직 한 번도 묻지 않았다 */
export function workoutAuthUndetermined(): boolean {
  try {
    return !!native && native.authorizationStatus() === 0;
  } catch {
    return false;
  }
}

/** 운동을 쓸 수 있는 기기인가 — 설정 화면이 「건강」 줄을 세울지 정한다 */
export function workoutAvailable(): boolean {
  try {
    return !!native && native.authorizationStatus() >= 0;
  } catch {
    return false;
  }
}

/** 운동 쓰기가 허용됐는가 */
export function workoutAuthorized(): boolean {
  try {
    return !!native && native.authorizationStatus() === 2;
  } catch {
    return false;
  }
}

/** 운동 세션을 켠다(이미 켜져 있으면 그대로). 권한 창이 떠 있으면 닫힌 뒤에 */
export async function startWorkoutSession(type: WorkoutType): Promise<string> {
  if (!native) return 'missing';
  if (pendingAuth) await pendingAuth;
  try {
    return await native.start(type);
  } catch (e) {
    return `throw ${String(e)}`;
  }
}

export function pauseWorkoutSession(): void {
  try {
    native?.pause();
  } catch {
    // 세션이 없거나 이미 멈춰 있다
  }
}

export function resumeWorkoutSession(): void {
  try {
    native?.resume();
  } catch {
    // 세션이 없거나 이미 돌고 있다
  }
}

/** 끝낸다 — save면 건강 앱에 남긴다. "saved"면 남았고 "none"이면 끝낼 세션이 없었다 */
export async function stopWorkoutSession(save: boolean): Promise<string> {
  if (!native) return 'missing';
  try {
    return await native.stop(save);
  } catch (e) {
    return `throw ${String(e)}`;
  }
}

/** 세션 없이 한 건 써넣는다 — 운동 세션을 못 켰던 운동(iOS 26 미만 등) */
export async function saveWorkoutRecord(
  type: WorkoutType,
  startMs: number,
  endMs: number
): Promise<string> {
  if (!native) return 'missing';
  try {
    return await native.saveWorkout(type, startMs, endMs);
  } catch (e) {
    return `throw ${String(e)}`;
  }
}

/** -1 세션 없음 · 2 실행 중 · 4 일시정지 */
export function workoutSessionState(): number {
  try {
    return native ? native.state() : -2;
  } catch {
    return -3;
  }
}

/** 안드로이드 — 헬스 커넥트 화면을 연다(안드로이드 14+는 설정 안에 있어 찾기 어렵다) */
export function openHealthConnect(): boolean {
  try {
    return !!native?.openHealthConnect?.();
  } catch {
    return false;
  }
}

/** 안드로이드 — 삼성 헬스가 깔려 있나 */
export function hasSamsungHealth(): boolean {
  try {
    return !!native?.hasSamsungHealth?.();
  } catch {
    return false;
  }
}

export function openSamsungHealth(): boolean {
  try {
    return !!native?.openSamsungHealth?.();
  } catch {
    return false;
  }
}
