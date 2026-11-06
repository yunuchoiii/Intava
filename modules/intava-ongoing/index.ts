/**
 * 안드로이드의 잠금화면 타이머 — 진행 중 알림 + 포그라운드 서비스(android/OngoingService.kt).
 *
 * 네이티브 모듈이 없는 플랫폼(iOS, Expo Go)에서는 아무것도 하지 않는다. iOS는 라이브 액티비티가
 * 같은 자리를 맡는다(src/live).
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export type OngoingPayload = {
  title: string;
  text: string;
  /** 지금 구간이 끝나는 시각(ms). 0이면 멈춤·완료 */
  endMs: number;
  /** 멈췄을 때 보일 남은 시간 「0:39」 */
  shortText: string;
  /** 단계 색 #RRGGBB */
  color: string;
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
