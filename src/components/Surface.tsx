/**
 * 표면 — 단색 + 엘리베이션.
 *
 * 글래스모피즘(반투명 + 뒤 배경 블러)은 쓰지 않는다. 이 앱의 화면은 뒤가
 * 불투명한 다크 배경이라 블러할 대상이 없고, 결국 흐릿한 회색 판으로만 보인다.
 * 그라디언트도 쓰지 않는다 — 표면 아래쪽이 배경 밝기와 같아지면서 경계가 사라진다.
 * 배경보다 밝은 단색 한 겹과 그림자로 높이를 만든다.
 *
 * 블러는 실제로 뒤에 내용이 깔리는 곳에서만 쓴다 — 시트(BlockSheet), 툴팁(InfoTip).
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { C, E2 } from '../theme';

type Props = {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** 그림자 — 기본은 e2. 더 띄우려면 LIFT를 넘긴다 */
  elevation?: ViewStyle;
  children?: React.ReactNode;
};

export function Surface({ radius = 14, style, elevation = E2, children }: Props) {
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: C.surface },
        elevation,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * 실행 화면 전용 — 페이즈 색 플러드 위에 얹히는 타일.
 * 여기서는 뒤에 색이 있으므로 흰 반투명이 재질로 읽힌다.
 */
export function FloodTile({ radius = 16, style, children }: Props) {
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
