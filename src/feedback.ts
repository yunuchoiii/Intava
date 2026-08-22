/**
 * 구간 전환 피드백 — 소리(계층 1)와 진동(계층 3)을 한 곳에서 묶는다.
 * 포그라운드에서는 여기서, 백그라운드에서 앱이 정지되면 알림 채널이 대신한다.
 */
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { play, type Cue } from './audio';
import { safetyNetArmed } from './notify';
import type { Phase, Settings } from './types';

const CUE_OF: Record<Phase, Cue> = {
  WARMUP: 'cue',
  PREPARE: 'cue',
  WORK: 'work',
  SET_REST: 'rest',
  BLOCK_REST: 'block',
  ROUND_REST: 'round',
  COOLDOWN: 'cooldown',
  DONE: 'done',
};

function impact(style: Haptics.ImpactFeedbackStyle, times: number, gap = 130): void {
  for (let i = 0; i < times; i++) {
    setTimeout(() => void Haptics.impactAsync(style), i * gap);
  }
}

function hapticFor(phase: Phase): void {
  const { Light, Medium, Heavy, Soft } = Haptics.ImpactFeedbackStyle;
  switch (phase) {
    case 'WORK':
      impact(Heavy, 1);
      break;
    case 'SET_REST':
      impact(Light, 1);
      break;
    case 'BLOCK_REST':
      impact(Medium, 2);
      break;
    case 'ROUND_REST':
      impact(Medium, 3);
      break;
    case 'COOLDOWN':
      impact(Soft, 2, 180);
      break;
    case 'DONE':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      impact(Heavy, 3, 220); // 긴 진동
      break;
    default:
      impact(Light, 1);
  }
}

/**
 * 구간이 바뀌는 순간.
 *
 * **백그라운드에서는 예약된 알림에게 맡기고 입을 다문다.**
 *
 * 포그라운드의 알림은 setNotificationHandler를 거치므로 조용히 지나가지만,
 * 백그라운드에서는 그 손을 거치지 않는다(iOS는 앱이 앞에 서 있을 때만 물어본다).
 * 그래서 앱이 살아 있는 채로 백그라운드에 있으면 **같은 전환에 소리가 두 번**
 * 났다 — 앱이 제때 한 번, 알림이 조금 뒤에 한 번. 실기기에서 "알림이 늦게 온다"로
 * 보고된 것이 이 겹침이었다(docs/notification-timing.md).
 *
 * 어느 한쪽만 말하게 한다. 상태마다 화자가 갈린다.
 *   앞에 서 있으면      → 앱이 낸다(정확하다). 알림은 핸들러가 삼킨다
 *   뒤에 있고 앱이 살면 → 알림이 낸다. 여기서 앱은 조용하다
 *   뒤에 있고 앱이 죽으면 → 알림이 낸다. 어차피 앱은 아무것도 못 한다
 *
 * 'inactive'(제어센터를 내렸거나 앱 전환기에 있는 동안)는 아직 앞이다 — iOS가
 * 핸들러를 거치므로 알림은 조용하다. 그때까지 입을 다물면 아무 소리도 안 난다.
 *
 * 맡길 알림이 없으면(설정에서 껐거나 권한이 없다) 앱이 그대로 낸다 — 조용한
 * 것보다는 낫다.
 *
 * 카운트다운 3·2·1은 이 규칙에서 뺀다(countdownFeedback). 예약된 알림에 짝이
 * 없어서, 입을 다물면 백그라운드에서 통째로 사라진다.
 */
export function segmentFeedback(phase: Phase, s: Settings): void {
  if (AppState.currentState === 'background' && safetyNetArmed()) return;
  if (s.sound) play(CUE_OF[phase]);
  if (s.vibration) hapticFor(phase);
}

/** 각 구간 마지막 3초 */
export function countdownFeedback(s: Settings): void {
  if (!s.countdownBeep) return;
  if (s.sound) play('tick');
  if (s.vibration) void Haptics.selectionAsync();
}

/** 휠 피커 스냅 등 가벼운 선택감 */
export function selectionTick(s?: Settings): void {
  if (s && !s.vibration) return;
  void Haptics.selectionAsync();
}

/**
 * 손끝의 대답 — 버튼을 누른 그 순간.
 *
 * 설정의 "진동"을 보지 않는다. 그 스위치는 **구간이 바뀔 때** 울릴지를 정하는
 * 것이다(운동 중에 화면을 안 보니까). 버튼을 눌렀을 때의 감각은 그것과 다른
 * 층이고, 눌렀는데 아무 대답이 없는 버튼은 고장 난 것처럼 느껴진다.
 * iOS 설정에서 시스템 햅틱을 끄면 어차피 전부 잠잠해진다.
 *
 * 두 단계뿐이다. 대부분은 tap — 화면을 넘기거나 값을 펼치는 것들.
 * commit은 **무언가가 실제로 벌어지는** 자리다: 시작 · 일시정지 · 저장.
 */
export function tapTick(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function commitTick(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
