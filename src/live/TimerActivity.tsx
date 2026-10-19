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
import { Capsule, HStack, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  background,
  font,
  foregroundStyle,
  frame,
  kerning,
  labelsHidden,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
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
  /*
    숫자만 끝을 1초 늦춘다 — 앱 타이머와 같은 올림(clock의 Math.ceil)으로 맞추려고.
    iOS의 타이머 글자는 남은 시간을 내림해서 3·2·1 뒤에 0이 1초 서 있다가 다음 구간이
    29부터 보였다. 끝을 1초 미루면 내림이 곧 올림이 되어 3·2·1 → 30으로 넘어간다.
    링은 실제 시각 그대로 둔다(1초 어긋나면 링이 덜 비고 넘어간다).

    시작도 1초 미룬다. 타이머 글자는 시작 전이면 구간 길이(끝−시작)를 그대로 보여서,
    끝만 미루면 갱신이 시작 시각보다 먼저 그려질 때 30초 구간이 31로 한 번 떴다(실기기).
    둘 다 미루면 길이가 30 그대로이고, 첫 1초 동안 보이는 값도 어차피 30이라 같다.
  */
  const segText = { lower: new Date(p.start + 1000), upper: new Date(p.end + 1000) };
  const whole = { lower: new Date(p.runStart), upper: new Date(p.runEnd) };
  const still = p.paused || p.done;

  /*
    링 — 안에 숫자를 두지 않고, 선을 굵게.

    SwiftUI의 원형 ProgressView(timerInterval:)는 남은 시간 글자(currentValueLabel)를
    링 **안에** 기본으로 붙인다. 옆에 큰 숫자가 있어 군더더기다. @expo/ui는 그 자리를
    열어 두지 않아서(labelsHidden으로도 안 걷혔다) 패치로 `hidesValueLabel`을 더했다 —
    patches/@expo+ui+*.patch. 타입에 없는 prop이라 펼쳐 넘긴다.

    선 굵기는 이 부품이 정해 두고, 크기에 비례해 굵어진다 — 작게 그려 키워도
    (scaleEffect) 비율이 그대로라 굵어지지 않았다. 그래서 **같은 시각으로 도는 링을
    조금씩 작게 겹친다.** 간격이 선보다 좁으면 얇은 선들이 붙어 하나의 굵은 띠가 된다.

    **둘만 겹친다.** 넷이면 원래 선의 세 배쯤이라 너무 두꺼웠고, 링마다 깔리는 반투명
    바탕 링도 네 번 겹쳐 진해졌다 — 바탕은 지울 수 없어 겹 수가 곧 바탕의 농도다.

    **간격은 3.5%로 좁게.** 반투명 바탕은 두 겹이 겹친 가운데만 진하고 가장자리는 한
    겹이라, 간격만큼 경계가 번져 보이고 불투명한 컬러 호만 두꺼워 보였다(7%일 때).
    간격을 줄이면 번지는 폭이 같이 줄어든다 — 두께 이득도 그만큼 작다.
  */
  const ring = (size: number) => {
    const hide: Record<string, boolean> = { hidesValueLabel: true };
    const layers = [0, 1];
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        {layers.map((k) => {
          const d = size * (1 - 0.035 * k);
          const mods = [progressViewStyle('circular'), tint(p.color), frame({ width: d, height: d })];
          return still ? (
            <ProgressView key={k} value={p.done ? 0 : p.fraction} modifiers={mods} />
          ) : (
            <ProgressView key={k} timerInterval={seg} countsDown {...hide} modifiers={mods} />
          );
        })}
      </ZStack>
    );
  };

  /*
    링이 들어갈 자리가 없으면 링을 **통째로 뺀다** — 반쯤 잘린 링보다 숫자 하나가 낫다.

    'ViewThatFitsView'는 패치로 위젯 렌더러에 더한 이름이다(patches/expo-widgets+*.patch).
    자식들을 차례로 대 보고 가로로 처음 들어가는 것 하나만 그린다(SwiftUI ViewThatFits).
    @expo/ui에 해당 컴포넌트가 없어 문자열 타입으로 바로 만든다 — 위젯 런타임의 jsx는
    문자열 타입을 그대로 노드로 넘긴다. 두 번째 후보는 폭 0짜리 빈칸이다.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Fits: any = 'ViewThatFitsView';
  const ringOrNothing = (size: number) => (
    <Fits>
      {ring(size)}
      <Spacer minLength={0} modifiers={[frame({ width: 0, height: 0 })]} />
    </Fits>
  );

  /*
    숫자 — 폭을 **못 박지 않고 상한만** 둔다. 자리가 모자라면 줄어들어서라도 끝까지 보인다.

    다른 라이브 액티비티(음악 등)가 같이 떠 있으면 iOS가 아일랜드를 둘로 나누어 이쪽
    폭이 좁아진다. 46pt로 못 박았을 때 거기서 「2:5」까지만 보이고 잘렸다(실기기).
  */
  const clock = (size: number, weight: 'bold' | 'heavy', width: number) =>
    still ? (
      <Text
        modifiers={[
          font({ size, weight }),
          monospacedDigit(),
          foregroundStyle(p.color),
          lineLimit(1),
          minimumScaleFactor(0.6),
          frame({ maxWidth: width, alignment: 'trailing' }),
        ]}
      >
        {p.done ? '' : p.remain}
      </Text>
    ) : (
      <Text
        timerInterval={segText}
        countsDown
        modifiers={[
          font({ size, weight }),
          monospacedDigit(),
          foregroundStyle(p.color),
          multilineTextAlignment('trailing'),
          lineLimit(1),
          minimumScaleFactor(0.6),
          frame({ maxWidth: width, alignment: 'trailing' }),
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
      {/* 이름 700, 아랫줄 600 — 아일랜드에서 한눈에 읽혀야 한다 */}
      <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>
        {p.name}
      </Text>
      <Text modifiers={[font({ size: 12.5, weight: 'semibold' }), foregroundStyle('#FFFFFF8C'), lineLimit(1)]}>
        {p.sub}
      </Text>
    </VStack>
  );

  /*
    막대 바탕은 회색 캡슐을 따로 깐다 — 시스템 막대의 트랙은 아일랜드의 검은 바탕에서
    거의 보이지 않아 남은 구간이 비어 보였다. 링 트랙과 비슷한 밝기로 맞춘다.
  */
  const bar = (
    <HStack spacing={10}>
      <ZStack>
        <Capsule modifiers={[foregroundStyle('#FFFFFF38'), frame({ height: 4 })]} />
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
      </ZStack>
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

  /*
    바탕(잠금화면 배너만) — 위는 검정, 아래로 갈수록 단계 색이 옅게 번진다. 지금이 운동인지 휴식인지
    숫자를 읽기 전에 색으로 먼저 안다. 단계 색은 #RRGGBB, 끝에 붙인 4D가 불투명도 30%다.
  */
  const glow = background({
    type: 'linearGradient',
    colors: ['#000000', `${p.color}4D`],
    startPoint: { x: 0.5, y: 0 },
    endPoint: { x: 0.5, y: 1 },
  });

  return {
    // 잠금화면 · 알림 센터 — 확장 상태와 같은 짜임을 한 장에
    banner: (
      <VStack
        spacing={14}
        modifiers={[
          padding({ horizontal: 20, top: 20, bottom: 16 }),
          glow,
          activityBackgroundTint('#000000'),
          widgetURL('intava://run'),
        ]}
      >
        {row}
        {bar}
      </VStack>
    ),
    /*
      애플 워치 스마트 스택(그리고 CarPlay) — 잠금화면 배너를 그대로 쓰면 좁은 화면에
      욱여넣어져 이름이 「새…」, 숫자가 「0…」으로 잘렸다(실기기). 워치에는 링 · 단계와
      이름 두 줄 · 큰 숫자만 한 줄로 둔다. 막대와 곁말은 뺀다.
    */
    bannerSmall: (
      <HStack
        spacing={10}
        alignment="center"
        modifiers={[padding({ horizontal: 10, vertical: 8 }), activityBackgroundTint('#000000')]}
      >
        {ring(34)}
        <VStack
          alignment="leading"
          spacing={1}
          modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}
        >
          <Text modifiers={[font({ size: 11, weight: 'bold' }), kerning(1.2), foregroundStyle(p.color)]}>
            {p.phase}
          </Text>
          <Text
            modifiers={[
              font({ size: 15, weight: 'bold' }),
              foregroundStyle('#FFFFFF'),
              lineLimit(1),
              minimumScaleFactor(0.75),
            ]}
          >
            {p.name}
          </Text>
        </VStack>
        {clock(26, 'heavy', 70)}
      </HStack>
    ),
    compactLeading: ringOrNothing(22),
    compactTrailing: clock(15, 'bold', 46),
    minimal: ring(22),
    expandedBottom: (
      // 아일랜드는 검은 바탕 그대로 — 둘레에 iOS 여백이 있어 단계 색 바탕을 깔면 검은 테두리 안에 네모로 갇혔다(실기기)
      <VStack spacing={14} modifiers={[padding({ horizontal: 6, top: 2, bottom: 4 })]}>
        {row}
        {bar}
      </VStack>
    ),
  };
};

export default createLiveActivity<TimerActivityProps>('IntavaTimer', TimerActivity);
