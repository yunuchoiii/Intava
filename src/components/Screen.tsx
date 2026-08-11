/**
 * 화면 배경 — 모든 화면이 단색이다.
 *
 * 한때 홈만 세로 그라디언트에 좌상단 글로우를 얹었는데, 그러면 같은 표면이 화면
 * 어디에 놓이느냐에 따라 달라 보인다. 목록이 스크롤되면 행이 지나가면서 배경 밝기가
 * 바뀌어 행 자체의 톤이 변하는 것처럼 읽혔다. 배경과 표면의 대비를 한 값으로 못 박는다.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from '../theme';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flex: 1, backgroundColor: C.bgPlain }, style]}>{children}</View>;
}
