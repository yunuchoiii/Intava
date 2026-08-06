import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenBackground } from '../src/components/Screen';
import { Wordmark } from '../src/components/Wordmark';
import { C } from '../src/theme';
import { installHandler } from '../src/notify';
import { StoreProvider } from '../src/store';

/**
 * 네이티브 스플래시는 첫 화면이 그려질 때까지 붙잡아 둔다.
 * 그냥 두면 자동으로 사라지면서 JS가 준비되기 전의 빈 루트 뷰(검정)가 한 번 비친다.
 */
void SplashScreen.preventAutoHideAsync();

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bgBase }} onLayout={onReady}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.bgPlain },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="edit" />
            <Stack.Screen name="run" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
          </Stack>

          {!splashGone && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.splash, { opacity: fade }]}
            >
              {/* 홈과 같은 그라디언트 — 스플래시에서 홈으로 넘어갈 때 배경이 바뀌지 않는다 */}
              <ScreenBackground />
              <View style={styles.splashCenter}>
                <Wordmark width={SPLASH_LOGO_WIDTH} />
              </View>
            </Animated.View>
          )}
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { backgroundColor: C.bgBase, zIndex: 100 },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
