/** 핸드오프 1장 — 데이터 모델 */

/** 종목. 블록 하나가 그 자체로 완결된 인터벌 타이머다. */
export type Block = {
  id: string;
  name: string;
  workSec: number;
  restSec: number;
  sets: number;
};

/** 루틴 / 타이머 */
export type Preset = {
  id: string;
  name: string;
  /**
   * 만들 때 정해 저장한다. 예전에는 blocks/rounds에서 파생시켰는데,
   * 종목 1개 · 라운드 1인 루틴이 타이머로 분류되어 루틴 편집 화면에
   * 영영 닿을 수 없는 문제가 있었다. 없는 값(구 데이터)은 파생으로 메운다.
   */
  kind?: PresetKind;
  warmupSec: number;
  prepareSec: number;
  blocks: Block[];
  blockRestSec: number;
  rounds: number;
  roundRestSec: number;
  cooldownSec: number;
  skipLastRest: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
};

/** 사용자가 고르는 값이 아니라 홈 탭 분류에만 쓰는 파생값 */
export type PresetKind = 'routine' | 'timer';

export function kindOf(p: Preset): PresetKind {
  return p.kind ?? (p.blocks.length > 1 || p.rounds > 1 ? 'routine' : 'timer');
}

export type Settings = {
  /** 홈 목록 정렬 — 화면을 떠났다 와도 유지된다 */
  sort: 'recent' | 'name' | 'created';
  sound: boolean;
  /** 잠금화면 알림 — 앱이 정지돼도 구간 전환을 알려주는 안전망 */
  notifications: boolean;
  vibration: boolean;
  countdownBeep: boolean;
  keepScreenOn: boolean;
  volume: number;
};

export const DEFAULT_SETTINGS: Settings = {
  sort: 'recent',
  sound: true,
  notifications: true,
  vibration: true,
  countdownBeep: true,
  keepScreenOn: false,
  volume: 0.8,
};

export type Phase =
  | 'WARMUP'
  | 'PREPARE'
  | 'WORK'
  | 'SET_REST'
  | 'BLOCK_REST'
  | 'ROUND_REST'
  | 'COOLDOWN'
  | 'DONE';

/** 구간 — 시작 시점에 루틴 전체를 이 배열로 펼친다 */
export type Segment = {
  phase: Phase;
  start: number;
  dur: number;
  round?: number;
  /** 이 라운드에서 몇 번째 종목인지. 실행 중 순서를 바꾸면 같은 종목이라도 달라진다 */
  blk?: number;
  /** 어느 종목인지 — 자리(blk)가 아니라 정체를 가리킬 때 쓴다 */
  blockId?: string;
  set?: number;
  sets?: number;
  name?: string;
};
