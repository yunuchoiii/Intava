/**
 * 내보내기 · 불러오기 — 이 앱의 데이터는 기기 안에만 있다.
 *
 * 백엔드가 없으니 앱을 지우거나 기기를 바꾸면 루틴도 기록도 전부 사라진다. 그
 * 하나뿐인 사본을 밖으로 꺼내 두는 길이다. 파일 하나에 루틴·설정·운동 기록을 담아
 * 공유 시트로 넘기고, 되돌릴 때는 파일을 골라 읽는다.
 *
 * **세 덩어리는 따로 논다.** 무엇을 담을지는 내보내는 사람이 고르고, 읽을 때는
 * 파일에 들어 있는 것만 되돌린다. 그래서 셋 다 선택 필드다 — 담지 않은 덩어리는
 * 아예 키가 없다. 빈 배열로 적어 두면 "비어 있는 채로 내보냈다"와 "안 골랐다"가
 * 구분되지 않아, 읽는 쪽에서 멀쩡한 기록을 빈 것으로 덮을 길이 열린다.
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

/**
 * 파일에 담기는 세 덩어리. 없으면 그 덩어리는 파일에 없다.
 *
 * `records`는 2판부터다 — 그보다 옛 파일에는 없으므로, 없다는 것이 곧
 * "안 골랐다"는 뜻은 아니다. 어느 쪽이든 읽는 쪽에서 하는 일은 같다(건드리지 않는다).
 */
export type BackupParts = {
  presets?: Preset[];
  settings?: Settings;
  records?: WorkoutRecord[];
};

export type Backup = BackupParts & {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
};

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 고른 덩어리만 파일로 만들어 공유 시트에 넘긴다.
 * 캐시에 쓴다 — 문서 폴더에 두면 지워지지 않고 쌓인다. 공유가 끝나면 OS가 알아서 치운다.
 */
export async function exportBackup(parts: BackupParts): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const backup: Backup = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    // JSON.stringify가 undefined인 열쇠를 알아서 뺀다 — 고르지 않은 덩어리는 파일에 없다
    ...parts,
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
 * - 형식이 아니거나 건질 것이 하나도 없으면 `'invalid'`
 *
 * **덩어리 하나만 들어 있어도 받는다.** 기록만 골라 내보낸 파일에는 루틴이 없는데,
 * 루틴이 없다고 파일 전체를 물리면 방금 내보낸 것을 제 앱이 못 읽는 꼴이 된다.
 * 셋 다 없을 때만 물린다 — 그때는 되돌릴 것이 정말로 없다.
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

    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.filter(isPreset)
      : undefined;
    const records = Array.isArray(parsed.records)
      ? parsed.records.filter(isRecord)
      : undefined;

    /*
      설정이 없으면 `undefined`를 돌려준다. 기본값으로 메워 돌려주면 부르는 쪽이
      "설정이 들어 있었다"로 읽고 사용자의 지금 설정을 기본값으로 덮어쓴다.
    */
    let settings: Settings | undefined;
    if (parsed.settings && typeof parsed.settings === 'object') {
      const incoming = parsed.settings as Partial<Settings>;
      settings = { ...DEFAULT_SETTINGS };
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        const v = incoming[key];
        if (typeof v === typeof DEFAULT_SETTINGS[key]) (settings[key] as unknown) = v;
      }
    }

    if (!presets?.length && !records?.length && !settings) return 'invalid';

    return {
      format: FORMAT,
      version: typeof parsed.version === 'number' ? parsed.version : VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      // 걸러낸 뒤 빈 배열이 된 것은 없는 것과 같이 다룬다 — 덮어쓸 것이 없다
      presets: presets?.length ? presets : undefined,
      records: records?.length ? records : undefined,
      settings,
    };
  } catch {
    return 'invalid';
  }
}
