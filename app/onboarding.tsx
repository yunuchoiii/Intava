/** 첫 설치 온보딩 — 풀스크린 모달(src/components/Onboarding.tsx에 왜 화면인지 적어 두었다) */
import { useRouter } from 'expo-router';
import React from 'react';
import { OnboardingPages } from '../src/components/Onboarding';
import { useStore } from '../src/store';

export default function OnboardingScreen() {
  const router = useRouter();
  const { finishOnboarding } = useStore();
  return (
    <OnboardingPages
      onDone={() => {
        void finishOnboarding().then(() => {
          // 딥링크(intava://onboarding)로 앱을 처음 열면 아래에 홈이 없다 — 돌아갈 곳이 없으면 홈으로
          if (router.canGoBack()) router.back();
          else router.replace('/');
        });
      }}
    />
  );
}
