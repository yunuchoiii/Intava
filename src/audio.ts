/**
 * 계층 1 — 오디오 세션으로 앱 살려두기 (핸드오프 4장)
 *
 * iOS는 오디오 백그라운드 모드가 활성화된 앱의 JS 타이머를 계속 돌려준다.
 * 실행 중에는 무음 루프를 재생해 세션을 붙잡아 둔다.
 *
 * 오디오 믹싱 정책: 음악을 **멈추지는 않는다.** 'doNotMix'는 쓰지 않는다.
 *
 * 기본은 'mixWithOthers' — 음악에 손대지 않고 알림음만 겹쳐 얹는다. 설정에서
 * "알림음 나올 때 음악 줄이기"를 켜면 알림음 앞뒤로만 'duckOthers'로 바꾼다.
 * 세션을 무음 루프로 운동 내내 붙잡고 있어서, 전역으로 켜면 0.5초가 아니라
 * 30분 내내 음악이 작아지기 때문이다.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * **모든 플레이어에 keepAudioSessionActive를 켠다.**
 *
 * expo-audio는 이 값이 꺼진 플레이어의 재생이 끝날 때마다 공유 오디오 세션을
 * 통째로 비활성화한다(AudioModule.onPlaybackComplete → deactivateSession).
 * 알림음 하나가 끝나는 순간 무음 루프까지 같이 죽는 구조라,
 *   - 백그라운드에서 첫 알림음이 끝나자마자 앱이 정지해 그 뒤 알림음이 안 나오고
 *   - 앱을 다시 열면 밀린 안내음 하나만 울리고
 *   - 세션이 소리마다 켜졌다 꺼지니 duckOthers가 알림음마다 음악을 잠깐씩만 눌렀다.
 * 기본값이 false라 옵션을 빼먹으면 그대로 재발한다.
 */
const KEEP_SESSION = { keepAudioSessionActive: true };

export type Cue =
  | 'cue' // 웜업/준비 시작 — 짧은 안내음
  | 'tick' // 카운트다운 3·2·1
  | 'work' // 운동 시작 — 높은 톤 롱비프
  | 'rest' // 세트 휴식 — 낮은 톤 롱비프
  | 'block' // 종목 전환 — 2음 하강
  | 'round' // 라운드 휴식 — 3음 하강
  | 'cooldown' // 쿨다운 — 2음 하강(부드럽게)
  | 'done'; // 전체 완료 — 3음 상승

const SOURCES: Record<Cue, number> = {
  cue: require('../assets/sounds/cue.wav'),
  tick: require('../assets/sounds/tick.wav'),
  work: require('../assets/sounds/work.wav'),
  rest: require('../assets/sounds/rest.wav'),
  block: require('../assets/sounds/block.wav'),
  round: require('../assets/sounds/round.wav'),
  cooldown: require('../assets/sounds/cooldown.wav'),
  done: require('../assets/sounds/done.wav'),
};

const SILENCE = require('../assets/sounds/silence.wav');

let players: Partial<Record<Cue, AudioPlayer>> = {};
let keepAlive: AudioPlayer | null = null;

/** 지금 세션에 적용돼 있는 모드. null이면 아직 한 번도 설정하지 않았다 */
let appliedDuck: boolean | null = null;
/** 설정값 — 알림음 나올 때 음악을 줄일지 */
let duckWanted = false;
let unduck: ReturnType<typeof setTimeout> | null = null;

/**
 * 마지막 알림음 뒤 이만큼 지나면 음악을 되돌린다.
 *
 * 알림음 하나하나에 모드를 껐다 켜지 않는 이유는 카운트다운이다 — 3·2·1이 1초
 * 간격으로 울리는데 그때마다 토글하면 비동기 호출이 서로 앞지른다. 마지막 소리
 * 뒤에 한 번만 되돌리면 그 사이는 눌린 채로 이어진다. 가장 긴 알림음이 0.98초라
 * 그보다 넉넉하게 잡았다.
 */
const DUCK_TAIL_MS = 1400;

async function applyMode(duck: boolean): Promise<void> {
  if (appliedDuck === duck) return;
  appliedDuck = duck;
  await setAudioModeAsync({
    playsInSilentMode: true, // 무음 스위치와 무관하게 재생
    shouldPlayInBackground: true, // 화면이 꺼져도 세션 유지
    // 음악을 멈추지는 않는다 — 그냥 얹거나(mix), 잠깐 낮추거나(duck)
    interruptionMode: duck ? 'duckOthers' : 'mixWithOthers',
    allowsRecording: false,
  });
}

/** 설정에서 바꾸면 알려준다. 끄는 순간 눌려 있던 음악은 바로 되돌린다 */
export function setDuckMusic(on: boolean): void {
  duckWanted = on;
  if (!on && appliedDuck) {
    if (unduck) {
      clearTimeout(unduck);
      unduck = null;
    }
    void applyMode(false);
  }
}

/** 알림음 앞뒤로만 음악을 낮춘다 — 연달아 울리면 마지막 소리 기준으로 미뤄진다 */
function duckAround(): void {
  if (!duckWanted) return;
  if (unduck) clearTimeout(unduck);
  void applyMode(true);
  unduck = setTimeout(() => {
    unduck = null;
    void applyMode(false);
  }, DUCK_TAIL_MS);
}

/** 실행 화면 진입 시 호출. 무음 루프로 세션을 붙잡고 알림음을 미리 로드한다. */
export async function startSession(volume: number): Promise<void> {
  await applyMode(false);
  if (!keepAlive) {
    keepAlive = createAudioPlayer(SILENCE, KEEP_SESSION);
    keepAlive.loop = true;
    // 파일 자체가 디지털 무음이다. 볼륨을 0으로 낮추면 세션이 유휴로 판정될 수 있어
    // 볼륨은 그대로 두고 소리 없는 트랙을 계속 돌린다.
    keepAlive.volume = 1;
  }
  keepAlive.play();

  for (const name of Object.keys(SOURCES) as Cue[]) {
    if (!players[name]) players[name] = createAudioPlayer(SOURCES[name], KEEP_SESSION);
    players[name]!.volume = volume;
  }
}

/**
 * 포그라운드로 돌아왔을 때 무음 루프가 살아 있는지 확인하고, 멎어 있으면 다시 켠다.
 *
 * 전화·Siri·알람이 끼어들면 expo-audio가 재생 중인 플레이어를 **전부 멈춘다.**
 * 되살아나는 것은 시스템이 `shouldResume`을 줄 때뿐이라, 안 주면 그대로 멎어 있다.
 * 이 루프가 멎으면 알림음만 빠지는 게 아니라 **백그라운드에서 타이머를 붙잡아 두는
 * 힘 자체가 사라진다** — 화면을 끄면 시간이 흐르지 않는 앱이 된다.
 */
export function resumeSession(): void {
  if (!keepAlive) return;
  try {
    // playing 판정을 믿지 않는다 — 시스템이 멈춘 직후에는 참으로 남아 있을 수 있고,
    // 이미 도는 플레이어에 play()를 다시 불러도 아무 해가 없다.
    keepAlive.play();
  } catch {
    // 정리 직후 등 — 소리 하나 살리자고 앱이 멈추면 안 된다
  }
}

/**
 * 실행 화면 이탈 시 호출.
 * 완료음은 화면이 바뀐 뒤에도 끝까지 울려야 하므로 잠깐 뒤에 정리한다.
 * 참조는 즉시 비워서 다시 시작할 때 새 플레이어와 섞이지 않게 한다.
 */
export function endSession(): void {
  const dying = players;
  const dyingKeepAlive = keepAlive;
  players = {};
  keepAlive = null;
  // 눌러 둔 음악을 그대로 두고 떠나지 않는다
  if (unduck) {
    clearTimeout(unduck);
    unduck = null;
  }
  void applyMode(false);
  setTimeout(() => {
    for (const p of Object.values(dying)) p?.remove();
    dyingKeepAlive?.pause();
    dyingKeepAlive?.remove();
  }, 1600);
}

export function setCueVolume(volume: number): void {
  for (const p of Object.values(players)) if (p) p.volume = volume;
}

/** 설정 화면의 볼륨 미리듣기 — 세션을 잡지 않고 한 번만 울린다 */
export async function preview(volume: number): Promise<void> {
  await applyMode(appliedDuck ?? false);
  // 미리듣기도 세션을 쥔 채 둔다 — 세션 중에 부르면 완료 순간 무음 루프까지 끊긴다
  const p = createAudioPlayer(SOURCES.work, KEEP_SESSION);
  p.volume = volume;
  p.play();
  setTimeout(() => p.remove(), 1500);
}

/**
 * 알림음 재생. 이미 끝까지 재생된 플레이어는 재생 위치가 끝에 남아 있어서
 * 그대로 play()를 부르면 소리가 나지 않는다(카운트다운 3·2·1의 2번째·3번째가
 * 빠지던 원인). 되감기가 끝난 뒤에 재생한다.
 *
 * **되감기에 tolerance 0을 명시해야 한다.** 인자를 하나만 주면 네이티브가 앞뒤
 * tolerance를 둘 다 무한대로 잡는데, AVPlayer는 그러면 "아무 데나 편한 지점"을
 * 허용한다 — 재생 헤드가 **끝에 그대로 머무는 것도 유효한 결과**다. 그 상태에서
 * play()를 부르면 actionAtItemEnd가 pause라 소리가 나지 않는다. 시뮬레이터에서는
 * 멀쩡하고 실기기에서만 알림음이 통째로 안 들리던 원인이 이것이다.
 */
export function play(name: Cue): void {
  const p = players[name];
  if (!p) return;
  duckAround();
  try {
    p.seekTo(0, 0, 0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // 플레이어가 정리된 직후 등 — 소리 하나 빠지는 것으로 앱이 멈추면 안 된다
  }
}

/**
 * 무음 루프가 멎었으면 다시 켠다 — 매 초 tick에서 부른다.
 *
 * iOS가 백그라운드에서 앱을 살려두는 조건은 **오디오가 실제로 나가고 있는 것**
 * 하나다. 루프가 한 번 멎으면 그 순간 앱이 정지하고, 정지한 뒤에는 되살릴 코드
 * 자체가 돌지 않는다 — 다시 열 때까지 조용하다. AppState 'active'에서만 확인하던
 * 것으로는 늦다. 멎기 전에, 살아 있는 동안 계속 확인해야 한다.
 *
 * resumeSession과 달리 여기서는 playing을 본다. 매 초 무조건 play()를 부르면
 * 네이티브가 재생 끝 알림과 시간 관찰자를 초마다 다시 단다.
 */
export function keepSessionAlive(): void {
  if (!keepAlive) return;
  try {
    if (!keepAlive.playing) keepAlive.play();
  } catch {
    // 정리 직후 등
  }
}
