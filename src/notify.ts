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
  /** 설정에서 잠금화면 알림을 껐으면 예약 자체를 하지 않는다 */
  enabled?: boolean;
  /** 이 예약이 아직 최신인지 — 도중에 더 새 요청이 오면 중단한다 */
  isCurrent?: () => boolean;
};

/**
 * 앞으로의 구간 전환 시각을 절대 시각(DATE 트리거)으로 넣는다.
 * **취소는 호출하는 쪽 책임이다** — 취소와 예약 사이에 다른 요청이 끼어들면
 * 알림이 중복되므로, 부르는 곳에서 토큰을 잡고 취소한 뒤 이 함수를 부른다.
 */
export async function scheduleUpcoming(args: ScheduleArgs): Promise<void> {
  const { plan, preset, zeroAt, elapsed, sound, vibration, enabled, isCurrent } = args;
  const current = () => (isCurrent ? isCurrent() : true);
  if (enabled === false) return;
  if (!sound && !vibration) return;
  if (!(await ensurePermission())) return;
  await ensureChannels();
  if (!current()) return;

  const now = Date.now();
  let count = 0;

  for (let i = 0; i < plan.segs.length && count < MAX_PENDING; i++) {
    // 예약 하나하나가 비동기다. 도중에 더 새 요청이 들어왔으면 여기서 멈춘다 —
    // 안 그러면 취소된 예약 위에 옛 예약이 덧쌓여 같은 알림이 두 번 뜬다
    if (!current()) return;
    const seg = plan.segs[i];
    if (seg.start <= elapsed) continue; // 이미 지난 전환
    const at = zeroAt + seg.start * 1000;
    if (at <= now + 500) continue;

    const { title, body } = notificationText(seg, plan.segs[i + 1], preset);
    await schedule(seg.phase, title, body, at, sound);
    count++;
  }

  // 마지막 — 전체 완료
  if (count < MAX_PENDING && current()) {
    const end = zeroAt + plan.total * 1000;
    if (end > now + 500) {
      await schedule('DONE', t('notify.doneTitle'), t('notify.doneBody', { name: preset.name }), end, sound);
    }
  }
}

/**
 * 절대 시각 트리거 — iOS는 CALENDAR로 준다.
 *
 * DATE 트리거는 iOS 네이티브(DateTriggerRecord)에서 ms를 초 단위로 **버림**한 뒤
 * "그 시각까지 남은 시간"을 재서 UNTimeIntervalNotificationTrigger, 즉 상대
 * 카운트다운으로 바꿔 넣는다. 카운트다운의 출발점이 예약을 처리하는 순간이라
 * 처리 지연이 그대로 얹히고, 만료도 벽시계가 아니라 타이머라 한 박자 늦는다 —
 * 알림이 실제 전환보다 살짝 늦게 오던 원인. CALENDAR는
 * UNCalendarNotificationTrigger로 벽시계의 그 초에 맞춰 울린다.
 *
 * 초는 반올림해서 넘긴다(전환 시각은 시작 시각의 ms 끝수를 따라 어중간한 자리에
 * 선다). 이미 지난 초를 가리키면 비반복 캘린더 트리거는 영영 울리지 않으므로,
 * 최소한 다음 초를 가리키게 민다.
 *
 * Android의 DATE는 AlarmManager.setExactAndAllowWhileIdle이라 정확하다 — 그대로 둔다.
 * (CALENDAR는 iOS 전용이기도 하다.)
 */
function triggerAt(
  atMs: number,
  channelId: string
): Notifications.NotificationTriggerInput {
  if (Platform.OS === 'ios') {
    const sec = Math.max(Math.round(atMs / 1000), Math.floor(Date.now() / 1000) + 1);
    const d = new Date(sec * 1000);
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      year: d.getFullYear(),
      month: d.getMonth() + 1, // JS는 0부터, DateComponents는 1부터
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(atMs),
    channelId,
  };
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
      trigger: triggerAt(atMs, spec.id),
    });
  } catch {
    // 예약 실패는 안전망의 실패일 뿐 — 실행 자체는 계속되어야 한다
  }
}
