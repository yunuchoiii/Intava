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
