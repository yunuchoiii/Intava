/**
 * intava 워드마크 — 디자이너가 낸 PNG를 그대로 쓴다.
 *
 * SVG 원본은 글자가 아직 <text>(League Spartan 800)라 앱에서 폰트로 다시
 * 그려야 하는데, 그러면 자간·막대 위치가 원본과 미세하게 어긋난다.
 * 시안과 한 픽셀도 다르지 않아야 하는 자리라 래스터를 쓴다.
 *
 * 가이드가 금지한 것: 대문자, 막대 길이·위치 조정, 기울임·그림자,
 * 글자와 막대 사이 벌리기. 크기만 바꿔 쓴다.
 */
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const SRC = {
  /** 어두운 배경 — 앱 내 헤더·설정 (빨강·초록 막대) */
  dark: require('../../assets/logo/lockup-dark.png'),
  /** 페이즈 색 위 — 막대가 흰색 + 흰색 50% */
  white: require('../../assets/logo/lockup-white.png'),
};

/** 원본 1224 × 500 */
export const WORDMARK_RATIO = 500 / 1224;
/** 가이드가 정한 최소 가로 크기 — 이보다 작으면 tava가 뭉개진다 */
export const WORDMARK_MIN_WIDTH = 88;

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
