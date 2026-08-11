import { Stack } from 'expo-router';
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Wordmark } from '../src/components/Wordmark';
import { C } from '../src/theme';
import { installHandler } from '../src/notify';
import { MiniTimer } from '../src/components/MiniTimer';
import { MorphProvider } from '../src/morph';
import { SessionProvider } from '../src/session';
import { StoreProvider } from '../src/store';
import { ToastHost } from '../src/components/Toast';

/**
 * 네이티브 스플래시는 첫 화면이 그려질 때까지 붙잡아 둔다.
 * 그냥 두면 자동으로 사라지면서 JS가 준비되기 전의 빈 루트 뷰(검정)가 한 번 비친다.
 */
void SplashScreen.preventAutoHideAsync();

/**
 * 네비게이션 컨테이너의 기본 테마는 라이트(흰 배경)다. 그대로 두면 화면이
 * 전환되는 동안 카드 뒤로 흰 바탕이 비친다.
 */
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bgPlain,
    card: C.bgPlain,
    text: C.textPrimary,
    border: C.divider,
  },
};

/** 네이티브 스플래시의 로고 크기와 같아야 이어붙는 순간이 보이지 않는다 */
const SPLASH_LOGO_WIDTH = 200;

export default function RootLayout() {
  const [splashGone, setSplashGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    installHandler();
  }, []);

  /**
   * 첫 레이아웃이 끝난 뒤에 네이티브 스플래시를 내린다. 그 아래에는 똑같은 자리에
   * 로고를 둔 겹이 이미 깔려 있어서, 내려가는 순간에는 아무 변화도 보이지 않는다.
   * 그 겹만 서서히 지우면 홈 화면이 드러난다.
   */
  const onReady = useCallback(async () => {
    await SplashScreen.hideAsync();
    Animated.timing(fade, {
      toValue: 0,
      duration: 420,
      delay: 120,
      useNativeDriver: true,
    }).start(() => setSplashGone(true));
  }, [fade]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bgPlain }} onLayout={onReady}>
      <SafeAreaProvider>
        <ThemeProvider value={NAV_THEME}>
          <StoreProvider>
            <SessionProvider>
              <MorphProvider>
              {/* 토스트는 스택 위에 떠야 하므로 화면들을 통째로 감싼다 */}
              <ToastHost>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.bgPlain },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            {/*
              편집 중 스와이프로 나가면 입력하던 값이 조용히 사라진다 — 제스처는 끈다.

              모달로 띄우지 않는다. 미니 바는 스택 바깥(루트)에 얹혀 있어서, 이 화면이
              모달로 뜨면 바를 덮어버린다 — 하단에 바 자리만 비어 보인다.
              실행 화면 위로는 이 화면을 올리지 않는다(run.tsx의 편집 버튼 참고).
            */}
            <Stack.Screen name="edit" options={{ gestureEnabled: false }} />
            {/*
              실행 화면을 닫는 길은 위에서 아래로 끌어내리는 것 하나다. 가장자리에서
              좌→우로 미는 뒤로가기는 끈다 — 두 방향이 같은 일을 하면 링을 문지르다
              화면이 넘어간다.

              투명 모달로 띄워 뒤 화면을 살려 둔다. 끌어내리는 동안 드러나는 것이
              검은 바탕이 아니라 원래 있던 화면(홈이든 편집이든)이 된다.

              화면 전환 애니메이션은 끈다 — 여닫는 몸짓은 MorphProvider가 그린다.
            */}
            <Stack.Screen
              name="run"
              options={{
                animation: 'none',
                gestureEnabled: false,
                presentation: 'transparentModal',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            {/*
              볼륨 슬라이더가 좌우 여백 24pt에서 시작해 가장자리 뒤로가기 제스처와
              겹친다. 시작 폭을 16pt로 좁혀 봤지만 소리를 줄이려다 화면이 넘어가는 일이
              계속 났다 — 슬라이더는 왼쪽 끝까지 끌어야 하는 물건이라 양보할 수가 없다.
              아래에서 올라오는 화면이라 좌→우 제스처가 원래 어울리지도 않는다. 끈다.
              나가는 길은 왼쪽 위 닫기 버튼이다.
            */}
            <Stack.Screen
              name="settings"
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            {/* 기록은 홈에서 옆으로 미끄러져 들어온다 — 목록 옆의 또 다른 목록이다 */}
            <Stack.Screen name="records" />
            {/* 방침·지원 — 설정에서 옆으로 들어온다 */}
            <Stack.Screen name="legal" />
          </Stack>

          <MiniTimer />

          {!splashGone && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.splash, { opacity: fade }]}
            >
              {/* 바탕은 styles.splash가 깐다 — 홈과 같은 단색이라 넘어가는 순간이 보이지 않는다 */}
              <View style={styles.splashCenter}>
                <Wordmark width={SPLASH_LOGO_WIDTH} />
              </View>
            </Animated.View>
          )}
              </ToastHost>
              </MorphProvider>
            </SessionProvider>
          </StoreProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  /** 네이티브 스플래시(app.json의 backgroundColor)와 같은 값이어야 이어붙는 순간이 안 보인다 */
  splash: { backgroundColor: C.bgPlain, zIndex: 100 },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
