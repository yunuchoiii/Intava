/** 인라인 SVG 아이콘 — 외부 이미지 파일 없음 (핸드오프 9장) */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

/**
 * ‹ — 뒤로. 편집·설정 화면 왼쪽 위, 나가는 문.
 *
 * 획으로 그린다. 글리프(‹)를 쓰면 폰트마다 굵기와 세로 위치가 달라져
 * 오른쪽 아이콘과 무게가 맞지 않는다.
 */
export function BackIcon({ size = 26, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Path
        d="M16.5 4.5 L8 13 l8.5 8.5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * ‹ › — 한 칸 앞으로 · 뒤로. 기록 화면의 월 이동.
 *
 * BackIcon과 같은 26 격자에 같은 획(2.2)으로 그린다. 크기만 작다.
 *
 * 글리프(‹ ›)를 쓰지 않는 이유는 BackIcon과 같되 여기서는 더 아프다. 이 둘은
 * 40×40 사각형 **한가운데**에 놓이는데, alignItems/justifyContent center가 가운데
 * 두는 것은 글자의 줄 상자이지 글리프의 잉크가 아니다. ‹(U+2039)는 따옴표 계열이라
 * em 박스 안에서 소문자 중간 높이에 앉아, 줄 상자를 가운데 두면 잉크는 그보다
 * 아래에 선다. 폰트가 바뀌면 치우친 양도 바뀌므로 마진 상수로 메우면 그 폰트에만
 * 맞는 답이 된다. 획으로 그리면 잉크의 기하학적 중심이 곧 뷰박스 중심이다.
 */
export function ChevronIcon({
  size = 20,
  color = '#FFFFFF',
  dir = 'left',
}: IconProps & { dir?: 'left' | 'right' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      {/*
        잉크가 x 9.5~16.5, y 6~20 — 가로세로 모두 26 격자의 정중앙(13)에 대칭이다.
        BackIcon은 x를 8~16.5로 잡아 살짝 왼쪽에 두는데(머리줄 왼쪽 끝에 서는
        글리프라 그쪽이 맞다) 여기는 사각형 한가운데라 대칭이어야 한다.

        폭:높이 = 1:2로 BackIcon과 같은 비율이되 한 단계 작다. size 20에서 획 끝까지
        재면 12.6pt × 획 1.85pt다. 대신 쓰던 ‹(20pt SF Pro)는 10.8pt에 획 1.6pt라,
        바뀌면 화살표가 조금 커지고 굵어진다 — 40pt 타일 안에서 글리프가 가늘고
        작았던 것이 맞다고 보고 그대로 둔다.
      */}
      <Path
        d="M16.5 6 L9.5 13 l7 7"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        // 오른쪽은 같은 획을 통째로 뒤집는다 — 두 방향의 무게가 같아야 한 쌍으로 읽힌다
        transform={dir === 'right' ? 'translate(26,0) scale(-1,1)' : undefined}
      />
    </Svg>
  );
}

/** 목록 — 실행 화면에서 종목 순서 시트를 여는 자리 */
export function ListIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[5, 11.25, 17.5].map((y) => (
        <React.Fragment key={y}>
          <Rect x="2" y={y} width="3.4" height="2.6" rx="1.3" fill={color} />
          <Rect x="8.4" y={y} width="13.6" height="2.6" rx="1.3" fill={color} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

export function PrevIcon({ size = 30, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={(size * 24) / 30} viewBox="0 0 20 16">
      <Path
        d="M18 1.4v13.2a1 1 0 0 1-1.55.83L7 9.1v5.5a1 1 0 0 1-2 0V1.4a1 1 0 0 1 2 0v5.5l9.45-6.3A1 1 0 0 1 18 1.4z"
        fill={color}
      />
      <Rect x="1" y="0" width="2.2" height="16" rx="1.1" fill={color} />
    </Svg>
  );
}

export function NextIcon({ size = 30, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={(size * 24) / 30} viewBox="0 0 20 16">
      <Path
        d="M2 1.4v13.2a1 1 0 0 0 1.55.83L13 9.1v5.5a1 1 0 0 0 2 0V1.4a1 1 0 0 0-2 0v5.5L3.55.57A1 1 0 0 0 2 1.4z"
        fill={color}
      />
      <Rect x="16.8" y="0" width="2.2" height="16" rx="1.1" fill={color} />
    </Svg>
  );
}

/**
 * 광학 보정 — 아이콘 안에 넣어 쓰는 곳마다 따로 보정하지 않게 한다.
 *
 * 두 가지를 함께 상쇄한다.
 *  1) 삼각형 잉크가 viewBox(15) 안에서 13.13까지만 차서 상자 중앙에 두면
 *     이미 왼쪽으로 0.94 단위 치우친다.
 *  2) 삼각형의 무게중심은 밑변 쪽(왼쪽 1/3 지점)이라, 기하학적으로 정확히
 *     가운데 두어도 눈에는 왼쪽으로 쏠려 보인다.
 * 합쳐서 폭의 21%를 오른쪽으로 밀면 무게중심이 원의 정중앙에 온다.
 */
export function PlayIcon({ size = 26, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg
      width={size}
      height={(size * 30) / 26}
      viewBox="0 0 15 17"
      style={{ marginLeft: size * 0.21 }}
    >
      <Path
        d="M0 1.2v14.6a1 1 0 0 0 1.53.85l11.6-7.3a1 1 0 0 0 0-1.7L1.53.35A1 1 0 0 0 0 1.2z"
        fill={color}
      />
    </Svg>
  );
}

/** 스피커 — 소리가 켜져 있으면 파동 2개, 꺼져 있으면 ✕ */
export function SpeakerIcon({ size = 22, color = '#FFFFFF', muted = false }: IconProps & { muted?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.4 9.3a1.1 1.1 0 0 1 1.1-1.1h2.3l4.1-3.3a.85.85 0 0 1 1.38.66v12.88a.85.85 0 0 1-1.38.66L6.8 15.8H4.5a1.1 1.1 0 0 1-1.1-1.1V9.3z"
        fill={color}
      />
      {muted ? (
        <>
          <Path d="M16.2 9.4l5 5.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
          <Path d="M21.2 9.4l-5 5.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path
            d="M15.9 9.5a3.5 3.5 0 0 1 0 5"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M18.7 7.2a7 7 0 0 1 0 9.6"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
}

/** 설정 — 링 + 톱니 8개. 기하로 그려서 획 굵기를 다른 아이콘과 맞춘다 */
export function GearIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {teeth.map((a) => (
        <Rect
          key={a}
          x={10.9}
          y={2.3}
          width={2.2}
          height={4.2}
          rx={1.1}
          fill={color}
          transform={`rotate(${a} 12 12)`}
        />
      ))}
      <Circle cx={12} cy={12} r={6} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={1.9} fill={color} />
    </Svg>
  );
}

/** 편집 — 연필 */
export function PencilIcon({ size = 21, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 16.6L15.2 5.4a1.6 1.6 0 0 1 2.3 0l1.1 1.1a1.6 1.6 0 0 1 0 2.3L7.4 20H4v-3.4z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M13.6 7l3.4 3.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function PauseIcon({ size = 26, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={(size * 30) / 26} viewBox="0 0 17 19">
      <Rect x="1" y="0" width="5.5" height="19" rx="1.8" fill={color} />
      <Rect x="10.5" y="0" width="5.5" height="19" rx="1.8" fill={color} />
    </Svg>
  );
}

/**
 * 달력 — 위 띠와 고리 둘, 그리고 날짜 점 넷.
 * 톱니(설정) 옆에 서므로 같은 24 격자에서 같은 무게로 그린다.
 */
export function CalendarIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  const dots = [
    [7.6, 13.6],
    [12, 13.6],
    [16.4, 13.6],
    [7.6, 17.4],
    [12, 17.4],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={3.2}
        y={4.8}
        width={17.6}
        height={16}
        rx={4}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      {/* 위 띠 — 날짜 칸과 머리를 가른다 */}
      <Rect x={3.2} y={9.4} width={17.6} height={1.7} fill={color} />
      {/* 고리 */}
      <Rect x={7.4} y={2.4} width={1.9} height={4.4} rx={0.95} fill={color} />
      <Rect x={14.7} y={2.4} width={1.9} height={4.4} rx={0.95} fill={color} />
      {dots.map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x - 1} y={y - 1} width={2} height={2} rx={1} fill={color} />
      ))}
    </Svg>
  );
}
