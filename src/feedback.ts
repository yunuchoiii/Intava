/**
 * 구간 전환 피드백 — 소리(계층 1)와 진동(계층 3)을 한 곳에서 묶는다.
 * 포그라운드에서는 여기서, 백그라운드에서 앱이 정지되면 알림 채널이 대신한다.
 */
import * as Haptics from 'expo-haptics';
import { play, type Cue } from './audio';
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
 * 구간이 바뀌는 순간 — **언제나 앱이 직접 낸다.**
 *
 * 한때 백그라운드에서는 입을 다물고 예약된 알림에게 소리를 맡겼다. 앱이 살아
 * 있는 채로 뒤에 있으면 같은 전환에 소리가 두 번 나기 때문이었다(포그라운드
 * 알림만 setNotificationHandler를 거치고, 백그라운드에서는 iOS가 묻지 않고
 * 그냥 울린다).
 *
 * **그 맞바꿈이 틀렸다.** 앱이 내는 소리는 `playsInSilentMode`라 **무음 스위치를
 * 무시하고** 울리지만, 알림음은 무음 스위치에 막힌다. 헬스장에서 벨소리를 꺼두는
 * 것이 보통이라, 소리를 알림에게 넘긴 순간 전환음이 통째로 사라졌다 — 짝이 되는
 * 알림이 없어 예외로 뒀던 카운트다운 3·2·1만 울리는 꼴이 됐다.
 *
 * 두 번 울리는 것은 성가시지만 한 번도 안 울리는 것은 앱이 고장 난 것이다.
 * 소리는 앱이 맡는다. 알림은 앱이 정지했을 때를 위한 안전망으로 둔다 —
 * 벨소리가 켜져 있는 사람에게는 그때도 들린다.
 */
export function segmentFeedback(phase: Phase, s: Settings): void {
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
