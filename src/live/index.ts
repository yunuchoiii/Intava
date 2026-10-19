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
 * iOS가 아니거나, 사용자가 설정에서 라이브 액티비티를 껐거나, 네이티브 모듈이 없는
 * 빌드(Expo Go)에서는 조용히 아무것도 하지 않는다 — 이것은 안전망 위의 덤이다.
 */
import { Platform } from 'react-native';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';
import type { TimerActivityProps } from './TimerActivity';

let factory: LiveActivityFactory<TimerActivityProps> | null | undefined;
let current: LiveActivity<TimerActivityProps> | null = null;
let lastSent = '';
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
export function syncLiveActivity(props: TimerActivityProps | null): void {
  const f = getFactory();
  if (!f) return;

  if (!props) {
    lastSent = '';
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
  if (key === lastSent) return;
  lastSent = key;

  const send = () => {
    try {
      if (!current) {
        // 앱이 다시 떴을 때 — 떠 있던 것을 이어받는다
        current = f.getInstances()[0] ?? null;
      }
      if (current) {
        void current.update(props).catch(() => {
          // 시스템이 이미 걷었다(사용자가 밀어 지웠거나 8시간이 지났다) — 다음 번에 새로 만든다
          current = null;
          lastSent = '';
        });
      } else {
        current = f.start(props, 'intava://run');
      }
    } catch {
      // 설정에서 라이브 액티비티를 껐거나 시스템이 거절했다 — 앱은 그대로 돈다
      current = null;
      lastSent = '';
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
