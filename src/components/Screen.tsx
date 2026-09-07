/**
 * 화면 배경 — 모든 화면이 단색이다.
 *
 * 한때 홈만 세로 그라디언트에 좌상단 글로우를 얹었는데, 그러면 같은 표면이 화면
 * 어디에 놓이느냐에 따라 달라 보인다. 목록이 스크롤되면 행이 지나가면서 배경 밝기가
 * 바뀌어 행 자체의 톤이 변하는 것처럼 읽혔다. 배경과 표면의 대비를 한 값으로 못 박는다.
 */
import React from 'react';
import { Keyboard, View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from '../theme';

/**
 * 글자를 쓰는 중에 **입력칸 바깥을 누르면 키보드를 내린다.**
 *
 * 손짓의 주인을 정하는 협상은 가장 깊은 곳부터 물어보고 위로 올라온다. 입력칸이나
 * 버튼이 그 손짓을 가져가면 여기까지 오지 않으므로, 여기 닿았다는 것은 곧
 * **아무것도 없는 자리를 눌렀다**는 뜻이다. 그때만 내린다.
 *
 * `false`를 돌려주어 손짓 자체는 가져가지 않는다 — 가져가면 그 아래 스크롤이나
 * 버튼이 먹통이 된다.
 *
 * 버튼을 누를 때는 여기까지 안 오므로 PressBox가 따로 내린다.
 */
export function dismissKeyboardOnEmptyTap() {
  return {
    onStartShouldSetResponder: () => {
      Keyboard.dismiss();
      return false;
    },
  };
}

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[{ flex: 1, backgroundColor: C.bgPlain }, style]}
      {...dismissKeyboardOnEmptyTap()}
    >
      {children}
    </View>
  );
}
