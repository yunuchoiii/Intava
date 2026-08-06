/**
 * 계층 2 — 로컬 알림 예약 (안전망) · 계층 3의 Android 진동 채널 (핸드오프 4장)
 *
 * OS가 앱을 완전히 정지시킨 경우를 대비해, 시작·재개·구간 이동 시점마다
 * 앞으로의 구간 전환 시각을 절대 시각 로컬 알림으로 미리 예약한다.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Plan } from './engine/segments';
import { notificationText } from './engine/labels';
import { t } from './i18n';
import type { Phase, Preset } from './types';
import { PHASE_COLOR } from './theme';

/** iOS는 대기 중 로컬 알림이 64개 제한 — 가까운 60개까지만 예약한다 */
const MAX_PENDING = 60;

type ChannelSpec = { id: string; name: string; sound: string; vibrationPattern: number[] };

/**
 * Android는 채널별 진동 패턴·소리를 쓴다. 페이즈마다 다른 채널을 두어야
 * 백그라운드에서도 운동/휴식이 다른 감각으로 구분된다.
 */
const CHANNELS: Record<Phase, ChannelSpec> = {
  WARMUP: { id: 'intava-cue', name: t('notify.channelCue'), sound: 'cue.wav', vibrationPattern: [0, 120] },
  PREPARE: { id: 'intava-cue', name: t('notify.channelCue'), sound: 'cue.wav', vibrationPattern: [0, 120] },
  WORK: { id: 'intava-work', name: t('notify.channelWork'), sound: 'work.wav', vibrationPattern: [0, 320] },
  SET_REST: {
    id: 'intava-rest',
    name: t('notify.channelRest'),
    sound: 'rest.wav',
    vibrationPattern: [0, 180],
  },
  BLOCK_REST: {
    id: 'intava-block',
    name: t('notify.channelBlock'),
    sound: 'block.wav',
    vibrationPattern: [0, 140, 90, 140],
  },
  ROUND_REST: {
    id: 'intava-round',
    name: t('notify.channelRound'),
    sound: 'round.wav',
    vibrationPattern: [0, 140, 90, 140, 90, 140],
  },
  COOLDOWN: {
    id: 'intava-cooldown',
    name: t('notify.channelCooldown'),
    sound: 'cooldown.wav',
    vibrationPattern: [0, 200, 120, 200],
  },
  DONE: {
    id: 'intava-done',
    name: t('notify.channelDone'),
    sound: 'done.wav',
    vibrationPattern: [0, 400, 150, 400, 150, 600],
  },
};

let handlerSet = false;
let channelsReady = false;

export function installHandler(): void {
  if (handlerSet) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // 포그라운드에서는 앱이 직접 소리·진동을 내므로 알림은 배너만 띄우고 조용히 지나간다
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

async function ensureChannels(): Promise<void> {
  if (channelsReady || Platform.OS !== 'android') return;
  const seen = new Set<string>();
  for (const spec of Object.values(CHANNELS)) {
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    await Notifications.setNotificationChannelAsync(spec.id, {
      name: spec.name,
      importance: Notifications.AndroidImportance.HIGH,
      sound: spec.sound,
      vibrationPattern: spec.vibrationPattern,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  channelsReady = true;
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

type ScheduleArgs = {
  plan: Plan;
  preset: Preset;
  /** 구간 offset 0초에 해당하는 절대 시각(ms). 일시정지 누적을 이미 반영한 값 */
  zeroAt: number;
  /** 지금 시점의 elapsed(초) — 이보다 앞선 구간은 예약하지 않는다 */
  elapsed: number;
  sound: boolean;
  vibration: boolean;
};

/**
 * 예약 시 기존 예약은 전부 취소 후 재생성한다 — 일시정지·스킵으로 시각이 밀린다.
 * 앞으로의 구간 전환 시각을 절대 시각(DATE 트리거)으로 넣는다.
 */
export async function scheduleUpcoming(args: ScheduleArgs): Promise<void> {
  const { plan, preset, zeroAt, elapsed, sound, vibration } = args;
  await cancelAll();
  if (!sound && !vibration) return;
  if (!(await ensurePermission())) return;
  await ensureChannels();

  const now = Date.now();
  let count = 0;

  for (let i = 0; i < plan.segs.length && count < MAX_PENDING; i++) {
    const seg = plan.segs[i];
    if (seg.start <= elapsed) continue; // 이미 지난 전환
    const at = zeroAt + seg.start * 1000;
    if (at <= now + 500) continue;

    const { title, body } = notificationText(seg, plan.segs[i + 1], preset);
    await schedule(seg.phase, title, body, at, sound);
    count++;
  }

  // 마지막 — 전체 완료
  if (count < MAX_PENDING) {
    const end = zeroAt + plan.total * 1000;
    if (end > now + 500) {
      await schedule('DONE', t('notify.doneTitle'), t('notify.doneBody', { name: preset.name }), end, sound);
    }
  }
}

async function schedule(
  phase: Phase,
  title: string,
  body: string,
  atMs: number,
  sound: boolean
): Promise<void> {
  const spec = CHANNELS[phase];
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: sound ? spec.sound : undefined,
        color: PHASE_COLOR[phase], // 잠금화면 좌측 색 막대 — 문구를 읽지 않아도 구분된다
        data: { phase },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(atMs),
        channelId: spec.id,
      },
    });
  } catch {
    // 예약 실패는 안전망의 실패일 뿐 — 실행 자체는 계속되어야 한다
  }
}
