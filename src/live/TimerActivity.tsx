/**
 * 다이내믹 아일랜드 · 잠금화면 타이머 — 라이브 액티비티의 생김새.
 *
 * 디자인: claude.ai/design 「인타바 다이내믹 아일랜드」. 실행 화면과 같은 문법이다 —
 * **단계 색 + 미니 링 + 타이머.**
 *   · 컴팩트(1a) — 왼쪽 끝 미니 링, 오른쪽 끝 숫자. 가운데는 카메라 자리
 *   · 확장(1b)   — 큰 링 · 단계/이름/곁말 · 큰 숫자, 아래에 전체 진행 막대와 「3 / 9 구간」
 *   · 미니멀(1c) — 다른 앱이 아일랜드를 쓰는 중이면 링 하나
 *
 * ⚠️ 이 함수는 `'widget'` 지시어 때문에 **문자열로 바뀌어 위젯 확장 안의 별도 런타임**에서
 *    돈다(babel-preset-expo의 widgets-plugin). 그래서 바깥의 상수·함수·i18n을 하나도
 *    부를 수 없다 — 색도 문구도 전부 props로 받는다. 안에서 쓰는 이름(ProgressView,
 *    font …)은 그 런타임의 전역으로 풀린다. 훅·상태·비동기도 안 된다.
 *
 * **숫자와 링은 iOS가 스스로 움직인다.** `Text`와 `ProgressView`에 구간의 시작·끝
 * 시각(timerInterval)을 주면 앱이 1초마다 갱신하지 않아도 내려간다. 앱은 구간이 바뀔
 * 때와 멈추고 재개할 때만 새 props를 보낸다(src/live/index.ts) — 라이브 액티비티
 * 갱신은 횟수 제한이 있어, 매 초 보내면 시스템이 걸러 버린다.
 *
 * 멈춘 동안에는 시각이 흐르면 안 되므로 timerInterval을 버리고 고정값(remain·fraction)을
 * 그린다.
 *
 * 디자인의 확장 상태에 있던 일시정지·건너뛰기 버튼은 아직 없다 — 이 버전의
 * expo-widgets는 라이브 액티비티의 버튼 입력을 문서로 약속하지 않는다.
 */
import { HStack, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  kerning,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
  scaleEffect,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type TimerActivityProps = {
  /** 「운동」 · 「휴식」 … */
  phase: string;
  /** 단계 색 — 검은 아일랜드 위에서 읽히는 밝은 쪽(LIVE_COLOR) */
  color: string;
  name: string;
  sub: string;
  /** 지금 구간의 시작·끝 (ms, 벽시계). 멈춘 동안에는 쓰지 않는다 */
  start: number;
  end: number;
  paused: boolean;
  /** 멈췄을 때 보일 남은 시간 「0:39」 */
  remain: string;
  /** 멈췄을 때 링에 남은 비율 0~1 */
  fraction: number;
  /** 「3 / 9 구간」 */
  stage: string;
  /** 운동 전체의 시작·끝 (ms) — 아래 막대 */
  runStart: number;
  runEnd: number;
  /** 멈췄을 때 전체 막대가 찬 비율 0~1 */
  runFraction: number;
  /** 다 끝났다 — 숫자 대신 단계말만 */
  done: boolean;
};

const TimerActivity = (p: TimerActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const seg = { lower: new Date(p.start), upper: new Date(p.end) };
  const whole = { lower: new Date(p.runStart), upper: new Date(p.runEnd) };
  const still = p.paused || p.done;

  /*
    링 — 안에 숫자를 두지 않고, 선을 굵게.

    SwiftUI의 원형 ProgressView(timerInterval:)는 남은 시간 글자를 링 **안에** 기본으로
    붙인다. 숫자는 바로 옆에 크게 있으니 링 안의 것은 군더더기다 — labelsHidden으로 걷는다.

    선 굵기는 이 부품이 정해 두고 바꾸게 하지 않는다. 그래서 **작게 그린 뒤 키운다** —
    scaleEffect는 그려진 것을 통째로 늘리므로 선도 같은 배율로 굵어진다. 늘어난 만큼의
    자리는 바깥 frame이 잡는다(scaleEffect는 배치를 바꾸지 않는다).
  */
  const ring = (size: number) => {
    const drawn = Math.round(size * 0.6);
    const mods = [
      progressViewStyle('circular'),
      labelsHidden(),
      tint(p.color),
      frame({ width: drawn, height: drawn }),
      scaleEffect(size / drawn),
      frame({ width: size, height: size }),
    ];
    return still ? (
      <ProgressView value={p.done ? 0 : p.fraction} modifiers={mods} />
    ) : (
      <ProgressView timerInterval={seg} countsDown modifiers={mods} />
    );
  };

  const clock = (size: number, weight: 'bold' | 'heavy', width: number) =>
    still ? (
      <Text
        modifiers={[
          font({ size, weight }),
          monospacedDigit(),
          foregroundStyle(p.color),
          frame({ width, alignment: 'trailing' }),
        ]}
      >
        {p.done ? '' : p.remain}
      </Text>
    ) : (
      <Text
        timerInterval={seg}
        countsDown
        modifiers={[
          font({ size, weight }),
          monospacedDigit(),
          foregroundStyle(p.color),
          multilineTextAlignment('trailing'),
          frame({ width, alignment: 'trailing' }),
        ]}
      />
    );

  /*
    가운데 글자 — 양쪽(링·숫자)을 뺀 너비를 **다 쓴다.** maxWidth를 크게 주면 SwiftUI는
    남은 자리만큼만 늘린다(무한대는 JSON으로 못 넘겨 큰 수로 갈음한다). 그래야 곁말이
    「3 / 3 세트 · 1 / 2 라…」처럼 잘리지 않는다.
  */
  const lines = (
    <VStack
      alignment="leading"
      spacing={3}
      modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}
    >
      <Text modifiers={[font({ size: 12, weight: 'bold' }), kerning(1.9), foregroundStyle(p.color)]}>
        {p.phase}
      </Text>
      <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>
        {p.name}
      </Text>
      <Text modifiers={[font({ size: 12.5, weight: 'semibold' }), foregroundStyle('#FFFFFF8C'), lineLimit(1)]}>
        {p.sub}
      </Text>
    </VStack>
  );

  const bar = (
    <HStack spacing={10}>
      {still ? (
        <ProgressView value={p.done ? 1 : p.runFraction} modifiers={[labelsHidden(), tint(p.color)]} />
      ) : (
        // 막대도 링처럼 흐른 시간 글자를 아래에 붙인다 — 걷는다
        <ProgressView
          timerInterval={whole}
          countsDown={false}
          modifiers={[labelsHidden(), tint(p.color)]}
        />
      )}
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), monospacedDigit(), foregroundStyle('#FFFFFF8C')]}>
        {p.stage}
      </Text>
    </HStack>
  );

  /*
    링 · 가운데 글자 · 숫자를 **한 줄에** 세운다 — 셋이 세로 가운데로 맞는다.

    아일랜드의 확장 영역을 왼쪽(링)·가운데(글자)·오른쪽(숫자)으로 나눠 쓰면 iOS가
    가운데를 카메라 **아래**에 따로 놓아 셋의 높이가 어긋난다(실제로 글자만 아래로
    처졌다). 그래서 확장은 아래 영역 하나에 이 줄과 막대를 통째로 넣는다.
  */
  const row = (
    <HStack spacing={14} alignment="center">
      {ring(52)}
      {lines}
      {clock(34, 'heavy', 96)}
    </HStack>
  );

  return {
    // 잠금화면 · 알림 센터 — 확장 상태와 같은 짜임을 한 장에
    banner: (
      <VStack
        spacing={14}
        modifiers={[
          padding({ horizontal: 20, vertical: 16 }),
          activityBackgroundTint('#000000'),
          widgetURL('intava://run'),
        ]}
      >
        {row}
        {bar}
      </VStack>
    ),
    compactLeading: ring(22),
    compactTrailing: clock(15, 'bold', 46),
    minimal: ring(22),
    expandedBottom: (
      <VStack spacing={14} modifiers={[padding({ horizontal: 6, top: 2, bottom: 4 })]}>
        {row}
        {bar}
      </VStack>
    ),
  };
};

export default createLiveActivity<TimerActivityProps>('IntavaTimer', TimerActivity);
