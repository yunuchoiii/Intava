/**
 * 라이브 액티비티(다이내믹 아일랜드 · 잠금화면)를 세션에 맞춰 켜고 갱신하고 끈다.
 *
 * **서버 없이 돈다.** 갱신은 전부 앱 안에서 한다 — 인타바는 무음 오디오로
 * 백그라운드에서도 살아 있어서(src/audio.ts), 알림을 다시 예약하는 바로 그 자리에서
 * 아일랜드도 같이 고칠 수 있다. 푸시(APNs)는 쓰지 않는다(enablePushNotifications 끔).
 *
 * 갱신은 **구간이 바뀔 때와 멈춤·재개·시간 이동 때만** 보낸다. 숫자와 링은
 * timerInterval을 받아 iOS가 스스로 내리므로(TimerActivity.tsx) 매 초 보낼 것이
 * 없다. 같은 내용을 두 번 보내지 않도록 마지막에 보낸 것을 기억한다.
 *
 * 앱이 죽었다 살아나면 떠 있던 액티비티를 새로 만들지 않고 이어받는다 — 그대로
 * 새로 시작하면 아일랜드에 같은 타이머가 둘 선다.
 *
 * 안드로이드는 라이브 액티비티 대신 진행 중 알림을 띄운다(아래 syncOngoing). 사용자가 설정에서
 * 껐거나, 네이티브 모듈이 없는 빌드(Expo Go)에서는 조용히 아무것도 하지 않는다 — 이것은 안전망 위의 덤이다.
 */
import { Platform } from 'react-native';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';
import type { TimerActivityProps } from './TimerActivity';
import { hideOngoing, showOngoing, type OngoingStep } from '../../modules/intava-ongoing';
import { t } from '../i18n';

let factory: LiveActivityFactory<TimerActivityProps> | null | undefined;
let current: LiveActivity<TimerActivityProps> | null = null;
let lastSent = '';
/**
 * 마지막 갱신이 실패했는가 — 그렇다면 내용이 같아도 다시 보낸다(liveNeedsRetry).
 *
 * 실기기에서 앱이 뒤에 있을 때 구간 전환 갱신이 반영되지 않아 아일랜드가 0:00에
 * 멈춘 채 남았다. 예전에는 실패하면 기억만 지우고 다음 구간 전환을 기다렸는데,
 * 앱을 열어도 구간이 그대로면 계기가 없어 재생/일시정지를 눌러야 풀렸다.
 */
let failed = false;
let lastTry = 0;
/** 실패 뒤 이만큼은 쉬었다 다시 보낸다 — 시스템이 거절하는 중에 매 초 두드리지 않게 */
const RETRY_MS = 3000;

/** 다시 보낼 때가 됐는가 — 세션의 매 초 tick이 묻는다 */
export function liveNeedsRetry(): boolean {
  return failed && Date.now() - lastTry >= RETRY_MS;
}
/** 끄는 중 — 끝나기 전에 다시 켜 달라는 요청이 오면 끝난 뒤에 새로 만든다 */
let ending: Promise<void> | null = null;

/** 처음 쓸 때 한 번만 불러온다 — 모듈을 들이는 순간 네이티브 쪽을 찾기 때문이다 */
function getFactory(): LiveActivityFactory<TimerActivityProps> | null {
  if (factory !== undefined) return factory;
  if (Platform.OS !== 'ios') return (factory = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = require('./TimerActivity').default as LiveActivityFactory<TimerActivityProps>;
  } catch {
    factory = null;
  }
  return factory;
}

/**
 * 지금 상태를 아일랜드에 반영한다. props가 null이면 끈다.
 * 몇 번을 불러도 내용이 같으면 아무것도 보내지 않는다.
 */
export function syncLiveActivity(
  props: TimerActivityProps | null,
  force = false,
  /** 안드로이드만 — 지금 구간부터 남은 구간들(진행 중 알림이 스스로 넘긴다) */
  steps: OngoingStep[] = []
): void {
  if (Platform.OS === 'android') {
    syncOngoing(props, force, steps);
    return;
  }
  const f = getFactory();
  if (!f) return;

  if (!props) {
    lastSent = '';
    failed = false;
    const target = current;
    current = null;
    // 앱이 죽었다 살아나 이어받지 못한 것까지 함께 걷는다
    const all = (() => {
      try {
        return f.getInstances();
      } catch {
        return [];
      }
    })();
    const ids = new Set<string>();
    const list = [target, ...all].filter((a): a is LiveActivity<TimerActivityProps> => {
      if (!a) return false;
      const id = safeId(a);
      if (ids.has(id)) return false;
      ids.add(id);
      return true;
    });
    if (list.length === 0) return;
    ending = Promise.all(list.map((a) => a.end('immediate').catch(() => undefined))).then(() => {
      ending = null;
    });
    return;
  }

  const key = JSON.stringify(props);
  if (!force && !failed && key === lastSent) return;
  lastSent = key;
  lastTry = Date.now();
  failed = false;

  /*
    구간이 끝난 뒤 다음 구간이 오지 않으면 「오래된 정보」로 표시되게 한다(staleDate).
    아이폰은 다음 구간을 바로 받지만 워치는 늦게 받거나 건너뛰어, 0:00에 멈춘 숫자가
    오래 남았다. 숫자 끝(구간 끝+1초) 뒤 2초를 더 기다린다. 멈춤·완료에는 걸지 않는다.
  */
  const stale = !props.paused && !props.done && props.end > 0 ? new Date(props.end + 3000) : undefined;

  const send = () => {
    try {
      if (!current) {
        // 앱이 다시 떴을 때 — 떠 있던 것을 이어받는다
        current = f.getInstances()[0] ?? null;
      }
      if (current) {
        void current.update(props, stale).catch(() => {
          // 거절됐거나 시스템이 이미 걷었다 — 몇 초 뒤 tick이 다시 보낸다. 걷힌 것이면
          // 그때 getInstances가 비어 새로 만든다
          current = null;
          failed = true;
        });
      } else {
        current = f.start(props, 'intava://run', stale);
      }
    } catch {
      // 설정에서 라이브 액티비티를 껐거나 시스템이 시작을 거절했다 — 앱은 그대로 돈다.
      // 다시 두드리지 않는다(failed를 세우지 않는다): 꺼 둔 사람에게 3초마다 묻는 꼴이다
      current = null;
    }
  };

  if (ending) void ending.then(send);
  else send();
}

function safeId(a: LiveActivity<TimerActivityProps>): string {
  try {
    return a.getId();
  } catch {
    return String(Math.random());
  }
}

/**
 * 안드로이드 — 라이브 액티비티 대신 진행 중 알림 + 포그라운드 서비스(modules/intava-ongoing).
 *
 * 같은 때(시작 · 멈춤 · 재개 · 구간 이동)에 **남은 일정 전체**를 보낸다 — 안드로이드의 RN은 앱이
 * 뒤에 가면 JS 타이머를 멈춰, 구간마다 JS가 고치는 방식으로는 첫 구간에 멈췄다(실기기). 서비스가
 * 구간 끝마다 스스로 다음으로 넘기고, 숫자는 크로노미터가 줄인다.
 */
function syncOngoing(props: TimerActivityProps | null, force: boolean, steps: OngoingStep[]): void {
  if (!props) {
    if (lastSent) hideOngoing();
    lastSent = '';
    return;
  }
  const still = props.paused || props.done;
  const payload = {
    steps: still ? [] : steps,
    pausedTitle: props.phase,
    pausedText: [props.paused ? props.remain : '', props.name].filter(Boolean).join(' · '),
    pausedColor: props.color,
    channelName: t('live.channel'),
  };
  const key = JSON.stringify(payload);
  if (!force && key === lastSent) return;
  lastSent = key;
  showOngoing(payload);
}
