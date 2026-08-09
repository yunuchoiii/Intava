/**
 * 내보내기 · 불러오기 — 이 앱의 데이터는 기기 안에만 있다.
 *
 * 백엔드가 없으니 앱을 지우거나 기기를 바꾸면 루틴도 기록도 전부 사라진다. 그
 * 하나뿐인 사본을 밖으로 꺼내 두는 길이다. 파일 하나에 루틴·설정·운동 기록을 담아
 * 공유 시트로 넘기고, 되돌릴 때는 파일을 골라 읽는다.
 *
 * **기록도 함께 담는다.** 지나간 날은 다시 만들 수 없다 — 루틴은 손으로 다시
 * 짜기라도 하지만, 언제 얼마나 했는지는 잃으면 그만이다.
 *
 * 읽어들이는 파일은 남이 만든 것일 수 있다 — 형식을 믿지 않고 한 겹씩 확인한다.
 */
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  DEFAULT_SETTINGS,
  type Block,
  type Preset,
  type Settings,
  type WorkoutRecord,
} from './types';

/** 파일 안에 박아두는 표식 — 아무 JSON이나 삼키지 않기 위해 */
const FORMAT = 'intava-backup';
/** 2 — 운동 기록이 더해진 판 */
const VERSION = 2;

export type Backup = {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  presets: Preset[];
  settings: Settings;
  /** 2판부터. 이보다 옛 파일에는 없으므로 읽을 때 빈 배열로 갈음한다 */
  records: WorkoutRecord[];
};

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 파일로 만들어 공유 시트에 넘긴다.
 * 캐시에 쓴다 — 문서 폴더에 두면 지워지지 않고 쌓인다. 공유가 끝나면 OS가 알아서 치운다.
 */
export async function exportBackup(
  presets: Preset[],
  settings: Settings,
  records: WorkoutRecord[]
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const backup: Backup = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    presets,
    settings,
    records,
  };

  const file = new File(Paths.cache, `intava-${stamp()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'intava',
  });
  return true;
}

// ── 읽어들이기 ────────────────────────────────────────────────────────────

function isBlock(v: unknown): v is Block {
  const b = v as Block;
  return (
    !!b &&
    typeof b.id === 'string' &&
    typeof b.name === 'string' &&
    Number.isFinite(b.workSec) &&
    Number.isFinite(b.restSec) &&
    Number.isFinite(b.sets)
  );
}

/**
 * 기록은 **보여줄 수 있으면 받는다.** 루틴처럼 실행에 쓰이는 것이 아니라 읽히기만
 * 하므로, 화면을 그리는 데 필요한 값만 갖추면 된다. 안쪽 목록은 없어도 카드가 선다.
 */
function isRecord(v: unknown): v is WorkoutRecord {
  const r = v as WorkoutRecord;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.presetName === 'string' &&
    Number.isFinite(r.startedAt) &&
    Number.isFinite(r.totalSec)
  );
}

function isPreset(v: unknown): v is Preset {
  const p = v as Preset;
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.blocks) &&
    p.blocks.length > 0 &&
    p.blocks.every(isBlock)
  );
}

/**
 * 파일을 고르게 하고 읽는다.
 * - 취소하면 `null`
 * - 형식이 아니면 `'invalid'`
 *
 * 설정은 아는 열쇠만 골라 받는다. 파일에 든 낯선 값이 그대로 들어오면
 * 이 앱이 알지 못하는 설정이 저장소에 남는다.
 */
export async function pickBackup(): Promise<Backup | 'invalid' | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  try {
    const raw = new File(picked.assets[0].uri).textSync();
    const parsed = JSON.parse(raw) as Partial<Backup>;
    if (parsed?.format !== FORMAT) return 'invalid';
    if (!Array.isArray(parsed.presets)) return 'invalid';

    const presets = parsed.presets.filter(isPreset);
    if (presets.length === 0) return 'invalid';

    const incoming = (parsed.settings ?? {}) as Partial<Settings>;
    const settings: Settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = incoming[key];
      if (typeof v === typeof DEFAULT_SETTINGS[key]) (settings[key] as unknown) = v;
    }

    return {
      format: FORMAT,
      version: typeof parsed.version === 'number' ? parsed.version : VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      presets,
      settings,
      // 1판 파일에는 없다 — 없다고 파일 전체를 물리지 않는다
      records: Array.isArray(parsed.records) ? parsed.records.filter(isRecord) : [],
    };
  } catch {
    return 'invalid';
  }
}
