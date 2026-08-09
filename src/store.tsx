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
import { DEFAULT_SETTINGS, type Preset, type Settings, type WorkoutRecord } from './types';
import { currentLanguage, t } from './i18n';

const SCHEMA_VERSION = 1;
const KEY_PRESETS = 'intava:presets';
const KEY_SETTINGS = 'intava:settings';
const KEY_RECORDS = 'intava:records';

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
  duplicatePreset: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** 백업 불러오기 — 같은 id는 덮어쓰고, 없는 것은 앞에 더한다 */
  mergePresets: (incoming: Preset[]) => void;
  /** 운동 기록 — 최근 것이 앞에 온다 */
  records: WorkoutRecord[];
  addRecord: (r: WorkoutRecord) => void;
  deleteRecord: (id: string) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await load<Preset[] | null>(KEY_PRESETS, null);
      const s = await load<Settings>(KEY_SETTINGS, DEFAULT_SETTINGS);
      const rec = await load<WorkoutRecord[]>(KEY_RECORDS, []);
      if (!alive) return;
      setRecords(Array.isArray(rec) ? rec : []);
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

  /**
   * 기록도 프리셋과 같은 이유로 직전 값을 기준으로 바꾼다 — 한 틱에 두 번
   * 불릴 일은 드물지만, 규칙을 한 곳에서만 다르게 두면 언젠가 걸린다.
   */
  const latestRecords = useRef(records);
  latestRecords.current = records;

  const persistRecords = useCallback((update: (prev: WorkoutRecord[]) => WorkoutRecord[]) => {
    const next = update(latestRecords.current);
    latestRecords.current = next;
    setRecords(next);
    void save(KEY_RECORDS, next);
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
      records,
      /** 최근 것이 앞 — 화면은 날짜로 다시 묶지만, 저장 자체는 시간순 역순이 자연스럽다 */
      addRecord: (r: WorkoutRecord) => persistRecords((prev) => [r, ...prev]),
      deleteRecord: (id: string) => persistRecords((prev) => prev.filter((x) => x.id !== id)),
      /** 복제 — 종목까지 새 id를 준다. 원본과 id를 공유하면 한쪽을 고칠 때 같이 바뀐다 */
      duplicatePreset: (id: string) =>
        persist((prev) => {
          const src = prev.find((p) => p.id === id);
          if (!src) return prev;
          const now = Date.now();
          const copy: Preset = {
            ...src,
            id: uid(),
            name: duplicateName(
              src.name,
              prev.map((p) => p.name)
            ),
            blocks: src.blocks.map((b) => ({ ...b, id: uid() })),
            createdAt: now,
            updatedAt: now,
            lastRunAt: undefined,
          };
          const at = prev.findIndex((p) => p.id === id);
          return [...prev.slice(0, at + 1), copy, ...prev.slice(at + 1)];
        }),
      markRun: (id: string) =>
        persist((prev) => prev.map((p) => (p.id === id ? { ...p, lastRunAt: Date.now() } : p))),
      setSettings: (patch: Partial<Settings>) => {
        const next = { ...settings, ...patch };
        setSettingsState(next);
        void save(KEY_SETTINGS, next);
      },
      mergePresets: (incoming: Preset[]) =>
        persist((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          const added: Preset[] = [];
          for (const p of incoming) {
            if (byId.has(p.id)) byId.set(p.id, p);
            else added.push(p);
          }
          // 기존 순서는 지키고, 새로 온 것만 앞에 놓는다
          return [...added, ...prev.map((p) => byId.get(p.id) ?? p)];
        }),
    }),
    [ready, presets, settings, persist, records, persistRecords]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore called outside StoreProvider');
  return v;
}

/**
 * 복제본 이름 — 이미 있는 이름이면 뒤에 번호를 올린다.
 *   전신 서킷 → 전신 서킷 사본 → 전신 서킷 사본 2 → 전신 서킷 사본 3
 *
 * 사본을 다시 복제해도 "사본 사본"이 되지 않는다. 접미사는 카탈로그에서
 * 빈 이름으로 한 번 렌더해 얻는다 — 언어마다 다른 말(사본/copy/のコピー/副本)을
 * 코드에 박아두지 않으려는 것이다.
 */
export function duplicateName(source: string, existing: string[]): string {
  const marker = t('list.duplicateSuffix', { name: '' }).trim();
  const stripped = source.replace(/\s*\d+$/, '').trim();
  const base = marker && stripped.endsWith(marker)
    ? stripped
    : t('list.duplicateSuffix', { name: source });

  let name = base;
  for (let n = 2; existing.includes(name); n++) {
    name = t('list.duplicateNumbered', { base, n });
  }
  return name;
}

/** 목록 정렬 기준 */
export type SortKey = 'recent' | 'name' | 'created';

export function sortPresets(list: Preset[], key: SortKey = 'recent'): Preset[] {
  const sorted = [...list];
  switch (key) {
    case 'name':
      // 언어별 정렬 규칙을 따른다 — 한글·가나·병음 순서가 로케일마다 다르다
      return sorted.sort((a, b) => a.name.localeCompare(b.name, currentLanguage()));
    case 'created':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    default:
      // 최근 실행순 — 실행한 적 없으면 마지막 수정 시각으로
      return sorted.sort((a, b) => (b.lastRunAt ?? b.updatedAt) - (a.lastRunAt ?? a.updatedAt));
  }
}
