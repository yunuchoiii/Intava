/** 핸드오프 7장 — 디자인 토큰. 다크 전용. */
import type { Phase } from './types';

export const C = {
  /**
   * 모든 화면의 배경. 핸드오프 원안(#0A0A0C / #141419 → #0B0B0E)보다 한 단계 밝다 —
   * 버튼 그림자가 인지되려면 바닥이 완전한 검정이면 안 된다.
   */
  bgPlain: '#17171C',
  /**
   * bgPlain의 알파 0 짝 — 배경색에서 투명으로 넘어가는 페이드에 쓴다.
   *
   * ⚠️ 여기에 'transparent'를 쓰면 안 된다. 그건 rgba(0,0,0,0)이라 중간 색이
   * 검정 쪽으로 끌려가서, 안드로이드에서 페이드 한가운데가 거뭇하게 번진다.
   * bgPlain을 고치면 이 값도 같이 고친다.
   */
  bgPlainClear: 'rgba(23,23,28,0)',
  textPrimary: '#F7F7F8',
  textSecondary: '#9A9EA6',
  textTertiary: '#6E7279',
  divider: 'rgba(255,255,255,0.09)',

  // 표면 — 배경보다 한 단계 밝은 단색. 그라디언트는 화면 배경에만 쓴다.
  // (그라디언트를 얹으면 아래쪽이 배경과 같은 밝기가 되어 경계가 사라진다.)
  surface: '#2A2A34',

  sheetTop: 'rgba(38,38,46,0.96)',
  sheetBottom: 'rgba(20,20,25,0.98)',

  white: '#F4F5F7',
  onWhite: '#0E0E11',

  danger: '#FF8A93',
  dangerBg: 'rgba(211,47,62,0.16)',

  // 기록 화면 — 볼륨(캘린더 농도)과 그 위의 글자, 운동 몫, 중단 배지, 주말
  volume: '#1FB3A1',
  volumeText: '#5FD8C6',
  recWork: '#F08A93',
  recWarn: '#E8A15C',
  sunday: '#E0656F',
  saturday: '#7E9BE0',
} as const;

export const PHASE_COLOR: Record<Phase, string> = {
  WARMUP: '#C96A1E',
  PREPARE: '#B8791F',
  WORK: '#D32F3E',
  SET_REST: '#12897C',
  BLOCK_REST: '#2B5BD7',
  ROUND_REST: '#6A3FD1',
  COOLDOWN: '#3E6B8F',
  DONE: '#1E8A5A',
};


export const RADIUS = {
  tile: 14,
  tab: 18,
  button: 22,
  card: 24,
  sheet: 34,
  pill: 999,
} as const;

export const GUTTER = 24;

/** StyleSheet.create 안에서 펼쳐 쓰는 절대 채움 */
export const ABS = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** 엘리베이션 — RN 그림자로 근사 */
export const E1 = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};
export const E2 = {
  shadowColor: '#000',
  shadowOpacity: 0.4,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
};
/** 떠 있는 버튼 — 배경에서 확실히 들리도록 넓고 깊게 */
export const LIFT = {
  shadowColor: '#000',
  shadowOpacity: 0.75,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 14 },
  elevation: 16,
};

export const E3 = {
  shadowColor: '#000',
  shadowOpacity: 0.55,
  shadowRadius: 50,
  shadowOffset: { width: 0, height: -20 },
  elevation: 24,
};

/** 숫자는 전부 tabular — 자릿수가 바뀌어도 흔들리지 않아야 한다 */
export const TABULAR = { fontVariant: ['tabular-nums' as const] };

function hex(v: number) {
  return Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, '0');
}

/** mix(base, target, amt) — 시안의 색 혼합과 동일 */
export function mix(base: string, target: string, amt: number): string {
  const b = base.replace('#', '');
  const t = target.replace('#', '');
  const p = (i: number) => parseInt(b.slice(i * 2, i * 2 + 2), 16);
  const q = (i: number) => parseInt(t.slice(i * 2, i * 2 + 2), 16);
  const c = (i: number) => hex(p(i) + (q(i) - p(i)) * amt);
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** 페이즈 플러드 배경의 세 색 */
export function floodColors(base: string) {
  return {
    light: mix(base, '#FFFFFF', 0.22),
    base,
    dark: mix(base, '#000000', 0.28),
  };
}
