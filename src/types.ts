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
  /**
   * 알림음이 울리는 동안 다른 앱의 음악을 낮춘다.
   *
   * 기본은 꺼짐이다 — 이 앱의 원래 약속은 "음악에 손대지 않는다"였고, 켜는 것은
   * 사용자가 고르는 쪽이어야 한다. 켜도 알림음 앞뒤로만 눌린다.
   */
  duckMusic: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sort: 'recent',
  sound: true,
  notifications: true,
  vibration: true,
  countdownBeep: true,
  keepScreenOn: false,
  volume: 0.8,
  duckMusic: false,
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

/**
 * 운동 기록 — 실행이 끝나면 완주든 중단이든 한 건 남는다.
 *
 * **고칠 수 없다.** 지우는 것만 된다. 지나간 일을 나중에 손보면 기록이 아니라
 * 메모가 된다. 루틴을 고치거나 지워도 기록은 그대로여야 하므로, 이름·구성처럼
 * 보여줄 것은 그때 그 문장을 **베껴 둔다**(참조하지 않는다).
 */
export type WorkoutRecord = {
  id: string;
  presetId: string;
  /** 실행 시점의 이름 — 루틴 이름이 나중에 바뀌어도 기록은 그날 그 이름이다 */
  presetName: string;
  startedAt: number;
  endedAt: number;
  /** 실제로 몸을 움직인 시간 — 멈춰 있던 동안과 건너뛴 구간은 빠진다 */
  totalSec: number;
  /** 그중 운동 구간 */
  workSec: number;
  completedSets: number;
  /** 끝까지 갔으면 참, ✕로 나갔으면 거짓 */
  completed: boolean;
  /** "3종목 2라운드" — 실행 시점의 말을 베껴 둔 것 */
  shape: string;
  /** 실제로 지나온 종목만 */
  blocks: RecordBlock[];
  /** 구간 스트립을 그릴 만큼만 — 지나온 구간의 종류와 길이 */
  segs: RecordSeg[];
};

export type RecordBlock = {
  name: string;
  /** "40초 운동 · 20초 휴식 · 4세트" */
  spec: string;
  /** 이 종목에서 실제로 보낸 시간 (휴식 포함) */
  durSec: number;
};

export type RecordSeg = { phase: Phase; durSec: number };
