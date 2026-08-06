/**
 * 계층 1 — 오디오 세션으로 앱 살려두기 (핸드오프 4장)
 *
 * iOS는 오디오 백그라운드 모드가 활성화된 앱의 JS 타이머를 계속 돌려준다.
 * 실행 중에는 무음 루프를 재생해 세션을 붙잡아 둔다.
 *
 * 오디오 믹싱 정책: 다른 앱의 음악을 절대 멈추거나 줄이지 않는다.
 * → interruptionMode는 항상 'mixWithOthers'. 'duckOthers'·'doNotMix' 사용 금지.
 *   (Android에서도 이 모드가 오디오 포커스를 요청하지 않는다.)
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

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
let configured = false;

async function configure(): Promise<void> {
  if (configured) return;
  await setAudioModeAsync({
    playsInSilentMode: true, // 무음 스위치와 무관하게 재생
    shouldPlayInBackground: true, // 화면이 꺼져도 세션 유지
    interruptionMode: 'mixWithOthers', // 음악을 멈추거나 줄이지 않는다
    allowsRecording: false,
  });
  configured = true;
}

/** 실행 화면 진입 시 호출. 무음 루프로 세션을 붙잡고 알림음을 미리 로드한다. */
export async function startSession(volume: number): Promise<void> {
  await configure();
  if (!keepAlive) {
    keepAlive = createAudioPlayer(SILENCE);
    keepAlive.loop = true;
    // 파일 자체가 디지털 무음이다. 볼륨을 0으로 낮추면 세션이 유휴로 판정될 수 있어
    // 볼륨은 그대로 두고 소리 없는 트랙을 계속 돌린다.
    keepAlive.volume = 1;
  }
  keepAlive.play();

  for (const name of Object.keys(SOURCES) as Cue[]) {
    if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
    players[name]!.volume = volume;
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
  await configure();
  const p = createAudioPlayer(SOURCES.work);
  p.volume = volume;
  p.play();
  setTimeout(() => p.remove(), 1500);
}

/**
 * 알림음 재생. 이미 끝까지 재생된 플레이어는 재생 위치가 끝에 남아 있어서
 * 그대로 play()를 부르면 소리가 나지 않는다(카운트다운 3·2·1의 2번째·3번째가
 * 빠지던 원인). 되감기가 끝난 뒤에 재생한다.
 */
export function play(name: Cue): void {
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // 플레이어가 정리된 직후 등 — 소리 하나 빠지는 것으로 앱이 멈추면 안 된다
  }
}
