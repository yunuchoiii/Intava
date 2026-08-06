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

/** 구간이 바뀌는 순간 */
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
