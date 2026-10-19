/**
 * iOS 운동 세션 — 시험용(라이브 액티비티 백그라운드 갱신 거절이 풀리는지).
 * 네이티브 모듈이 없는 빌드·플랫폼에서는 조용히 아무것도 하지 않는다.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  requestAuthorization(): Promise<string>;
  authorizationStatus(): number;
  start(): Promise<string>;
  stop(): Promise<string>;
  state(): number;
};

const native = requireOptionalNativeModule<Native>('IntavaWorkout');

export async function startWorkoutSession(): Promise<string> {
  if (!native) return 'missing';
  // 권한 창이 떠 있으면 닫힌 뒤에 — 같은 요청이 겹치지 않게
  if (pendingAuth) await pendingAuth;
  try {
    return await native.start();
  } catch (e) {
    return `throw ${String(e)}`;
  }
}

export async function stopWorkoutSession(): Promise<string> {
  if (!native) return 'missing';
  try {
    return await native.stop();
  } catch (e) {
    return `throw ${String(e)}`;
  }
}

export function workoutSessionState(): number {
  try {
    return native ? native.state() : -2;
  } catch {
    return -3;
  }
}

/** 앱이 처음 열릴 때 — 이미 답했으면 창 없이 지나간다 */
let pendingAuth: Promise<string> | null = null;
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
