/**
 * 안드로이드의 잠금화면 타이머 — 진행 중 알림 + 포그라운드 서비스(android/OngoingService.kt).
 *
 * 네이티브 모듈이 없는 플랫폼(iOS, Expo Go)에서는 아무것도 하지 않는다. iOS는 라이브 액티비티가
 * 같은 자리를 맡는다(src/live).
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export type OngoingStep = {
  title: string;
  text: string;
  /** 이 구간이 끝나는 시각(ms) */
  endMs: number;
  /** 단계 색 #RRGGBB */
  color: string;
};

/**
 * 지금 구간부터 남은 구간들 — 서비스가 구간 끝마다 스스로 다음으로 넘긴다(앱의 JS가 뒤에서 멈춰도).
 * 멈춘 동안에는 steps를 비우고 paused*를 고정해 보인다.
 */
export type OngoingPayload = {
  steps: OngoingStep[];
  pausedTitle: string;
  pausedText: string;
  pausedColor: string;
  /** 알림 설정 화면에 보일 채널 이름 */
  channelName: string;
};

type Native = { show(p: OngoingPayload): boolean; hide(): boolean };

const native = requireOptionalNativeModule<Native>('IntavaOngoing');

export function showOngoing(p: OngoingPayload): void {
  try {
    native?.show(p);
  } catch {
    // 알림 권한이 없거나 시스템이 거절했다 — 타이머는 그대로 돈다
  }
}

export function hideOngoing(): void {
  try {
    native?.hide();
  } catch {
    // 이미 내려갔다
  }
}
