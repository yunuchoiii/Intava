/**
 * 로컬 저장소 — 백엔드 없음. AsyncStorage에 JSON 직렬화하고
 * 스키마 버전 필드를 함께 저장해 향후 마이그레이션 여지를 둔다. (핸드오프 1장)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_SETTINGS, type Preset, type Settings } from './types';
import { t } from './i18n';

const SCHEMA_VERSION = 1;
const KEY_PRESETS = 'intava:presets';
const KEY_SETTINGS = 'intava:settings';

type Envelope<T> = { version: number; data: T };

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const env = JSON.parse(raw) as Envelope<T>;
    if (typeof env?.version !== 'number') return fallback;
    // 지금은 v1 뿐이다. 버전이 올라가면 여기서 마이그레이션한다.
    return env.data ?? fallback;
  } catch {
    return fallback;
  }
}

async function save<T>(key: string, data: T): Promise<void> {
  const env: Envelope<T> = { version: SCHEMA_VERSION, data };
  await AsyncStorage.setItem(key, JSON.stringify(env));
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 첫 실행 시 심어두는 예시 — 핸드오프 3장의 검증 예시와 같은 값 */
function seedPresets(): Preset[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      name: t('seed.circuit'),
      warmupSec: 60,
      prepareSec: 10,
      blocks: [
        { id: uid(), name: t('seed.squat'), workSec: 40, restSec: 20, sets: 4 },
        { id: uid(), name: t('seed.pushup'), workSec: 30, restSec: 15, sets: 3 },
        { id: uid(), name: t('seed.plank'), workSec: 60, restSec: 30, sets: 2 },
      ],
      blockRestSec: 30,
      rounds: 2,
      roundRestSec: 90,
      cooldownSec: 120,
      skipLastRest: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: t('seed.tabata'),
      warmupSec: 0,
      prepareSec: 10,
      blocks: [{ id: uid(), name: t('seed.tabata'), workSec: 20, restSec: 10, sets: 8 }],
      blockRestSec: 30,
      rounds: 1,
      roundRestSec: 90,
      cooldownSec: 0,
      skipLastRest: true,
      createdAt: now - 1,
      updatedAt: now - 1,
    },
  ];
}

export function emptyPreset(kind: 'routine' | 'timer'): Preset {
  const now = Date.now();
  return kind === 'timer'
    ? {
        id: uid(),
        kind: 'timer',
        name: t('defaults.timerName'),
        warmupSec: 0,
        prepareSec: 10,
        blocks: [{ id: uid(), name: t('defaults.timerName'), workSec: 30, restSec: 15, sets: 8 }],
        blockRestSec: 30,
        rounds: 1,
        roundRestSec: 90,
        cooldownSec: 0,
        skipLastRest: true,
        createdAt: now,
        updatedAt: now,
      }
    : {
        id: uid(),
        kind: 'routine',
        name: t('defaults.routineName'),
        warmupSec: 0,
        prepareSec: 10,
        blocks: [{ id: uid(), name: t('defaults.blockName', { n: 1 }), workSec: 30, restSec: 60, sets: 3 }],
        blockRestSec: 120,
        rounds: 1,
        roundRestSec: 120,
        cooldownSec: 0,
        skipLastRest: true,
        createdAt: now,
        updatedAt: now,
      };
}

type StoreValue = {
  ready: boolean;
  presets: Preset[];
  settings: Settings;
  getPreset: (id?: string) => Preset | undefined;
  savePreset: (p: Preset) => void;
  deletePreset: (id: string) => void;
  markRun: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await load<Preset[] | null>(KEY_PRESETS, null);
      const s = await load<Settings>(KEY_SETTINGS, DEFAULT_SETTINGS);
      if (!alive) return;
      if (stored === null) {
        const seeded = seedPresets();
        setPresets(seeded);
        void save(KEY_PRESETS, seeded);
      } else {
        setPresets(stored);
      }
      setSettingsState({ ...DEFAULT_SETTINGS, ...s });
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 렌더 시점의 스냅샷이 아니라 **직전 값**을 기준으로 바꾼다.
   * savePreset() 직후 markRun()처럼 한 틱에 두 번 부르면, 스냅샷 기준으로는
   * 두 번째 호출이 첫 번째 결과를 지운다 — 새로 만든 프리셋이 저장되자마자
   * 사라져 실행 화면이 빈 화면으로 뜨던 원인이다.
   */
  const latest = useRef(presets);
  latest.current = presets;

  const persist = useCallback((update: (prev: Preset[]) => Preset[]) => {
    const next = update(latest.current);
    latest.current = next;
    setPresets(next);
    void save(KEY_PRESETS, next);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      presets,
      settings,
      getPreset: (id?: string) => presets.find((p) => p.id === id),
      savePreset: (p: Preset) => {
        const next = { ...p, updatedAt: Date.now() };
        persist((prev) =>
          prev.some((x) => x.id === p.id)
            ? prev.map((x) => (x.id === p.id ? next : x))
            : [next, ...prev]
        );
      },
      deletePreset: (id: string) => persist((prev) => prev.filter((p) => p.id !== id)),
      markRun: (id: string) =>
        persist((prev) => prev.map((p) => (p.id === id ? { ...p, lastRunAt: Date.now() } : p))),
      setSettings: (patch: Partial<Settings>) => {
        const next = { ...settings, ...patch };
        setSettingsState(next);
        void save(KEY_SETTINGS, next);
      },
    }),
    [ready, presets, settings, persist]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore called outside StoreProvider');
  return v;
}

/** 목록 정렬 — 최근 실행순(lastRunAt desc, 없으면 updatedAt) */
export function sortPresets(list: Preset[]): Preset[] {
  return [...list].sort((a, b) => (b.lastRunAt ?? b.updatedAt) - (a.lastRunAt ?? a.updatedAt));
}
