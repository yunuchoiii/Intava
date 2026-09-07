/**
 * 스토어 리뷰 요청 — **앱 생애 한 번뿐이다.**
 *
 * 언제 묻는가가 이 파일의 전부다. 운동을 **끝까지 마친 것이 세 번 쌓인 사람에게,
 * 완료 화면에서, 한 번만** 묻는다. 도중에 ✕로 나간 운동은 세지 않는다 — 그 사람은
 * 지금 이 앱에 만족한 상태가 아니고, 그 자리에서 별점을 물으면 낮은 별을 받는다.
 *
 * `expo-store-review`는 **다이얼로그가 실제로 떴는지 알려주지 않는다**(v57 문서:
 * "no callback mechanism; developers cannot determine if the dialog actually
 * appeared"). iOS가 1년에 세 번으로 스스로 제한하기도 해서, 우리가 부른 것과
 * 사용자가 본 것은 애초에 같지 않다. 그래서 이 파일이 세는 것은 **우리가 물은
 * 횟수**다 — 부르기 직전에 「물었음」을 남기고, 그 뒤로는 영영 다시 부르지 않는다.
 * 떴는지 확인하려다 다시 묻는 길을 열어 두면 그것이 곧 성가심이 된다.
 */
import * as StoreReview from 'expo-store-review';
import { load, save } from './store';

const KEY = 'intava:review';

/** 이만큼 완주해야 묻는다 */
const NEEDED = 3;

/**
 * 완료 화면이 뜨고 이만큼 뒤에 묻는다.
 *
 * 화면에 닿자마자 시스템 창을 얹으면 방금 끝낸 운동의 숫자를 가린다. 잠깐 두어
 * 제 기록을 먼저 보게 한 뒤에 묻는다. 그 사이에 홈으로 나가면 묻지 않는다.
 */
const ASK_DELAY_MS = 1600;

type Kept = {
  /** 끝까지 마친 운동의 수 */
  finished: number;
  /** 이미 물었는지 — 참이 되면 다시는 묻지 않는다 */
  asked: boolean;
};

const NONE: Kept = { finished: 0, asked: false };

/**
 * 완주 한 건을 세고, 때가 됐으면 리뷰를 청한다.
 *
 * **세는 것은 즉시, 묻는 것은 잠깐 뒤다.** 돌려주는 함수를 부르면 묻는 것만
 * 취소된다 — 화면을 떠난 뒤에 창이 뜨면 엉뚱한 자리에 얹히기 때문이다. 이미 센
 * 것은 취소되지 않는다.
 *
 * 완주가 아닌 실행에서는 **부르지 않는다**(부르는 쪽이 가린다).
 */
export function noteFinishedWorkout(delayMs = ASK_DELAY_MS): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  void (async () => {
    try {
      const kept = await load<Kept>(KEY, NONE);
      if (kept.asked) return;

      const finished = kept.finished + 1;
      // 세는 것은 화면을 떠나든 말든 남는다
      await save<Kept>(KEY, { ...kept, finished });
      if (finished < NEEDED) return;

      /*
        물을 수 없는 자리에서는 아무것도 하지 않는다 — 「물었음」도 남기지 않는다.
        웹, Android 5.0 미만, 그리고 **TestFlight**가 여기 걸린다. 내부 테스트에서
        생애 한 번을 태워 버리면 정작 스토어에서 받은 사람에게는 영영 못 묻는다.
      */
      if (!(await StoreReview.isAvailableAsync())) return;
      if (cancelled) return;

      timer = setTimeout(() => {
        void (async () => {
          // 부르기 **전에** 잠근다 — 떴는지 알 수 없으므로 부른 것으로 센다
          await save<Kept>(KEY, { finished, asked: true });
          try {
            await StoreReview.requestReview();
          } catch {
            // 리뷰 하나 못 물은 것으로 완료 화면이 무너지면 안 된다
          }
        })();
      }, delayMs);
    } catch {
      // 저장소가 말썽이어도 마찬가지다 — 조용히 지나간다
    }
  })();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
