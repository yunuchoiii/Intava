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
        void finishOnboarding().then(() => router.back());
      }}
    />
  );
}
