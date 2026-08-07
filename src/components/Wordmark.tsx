/**
 * intava 가로 잠금형 — 끊긴 링 심볼 + 글자. 디자이너가 낸 PNG를 그대로 쓴다.
 *
 * SVG 원본은 글자가 아직 <text>(League Spartan 800)라 앱에서 폰트로 다시
 * 그려야 하는데, 그러면 자간이 원본과 미세하게 어긋난다.
 * 시안과 한 픽셀도 다르지 않아야 하는 자리라 래스터를 쓴다.
 *
 * 가이드가 금지한 것: 두 호의 비율(240°/120°) 변경, 이음매 틈 메우기,
 * 링 회전, 링에 그라디언트, 글자에 색 넣기. 크기만 바꿔 쓴다.
 */
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const SRC = {
  /** 어두운 배경 — 앱 내 헤더·설정 (빨강·초록 막대) */
  dark: require('../../assets/logo/lockup-dark.png'),
  /** 페이즈 색 위 — 막대가 흰색 + 흰색 50% */
  white: require('../../assets/logo/lockup-white.png'),
};

/** 원본 1288 × 296 */
export const WORDMARK_RATIO = 296 / 1288;
/**
 * 최소 가로 크기.
 * 가이드는 심볼이 28px 아래로 내려가면 이음매 틈이 안티에일리어싱으로 메워져
 * 하나의 링으로 보인다고 못 박았다. 잠금형 안에서 링이 가로폭의 21.2%를
 * 차지하므로 28 / 0.212 ≈ 133이 하한이다.
 */
export const WORDMARK_MIN_WIDTH = 133;

type Props = {
  /** 가로 크기(px). 세로는 비율로 따라온다 */
  width: number;
  tone?: keyof typeof SRC;
  style?: StyleProp<ImageStyle>;
  opacity?: number;
};

export function Wordmark({ width, tone = 'dark', style, opacity = 1 }: Props) {
  return (
    <Image
      source={SRC[tone]}
      style={[{ width, height: width * WORDMARK_RATIO, opacity }, style]}
      resizeMode="contain"
      accessible
      accessibilityLabel="intava"
    />
  );
}
