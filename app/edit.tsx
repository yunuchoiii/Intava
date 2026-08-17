/**
 * 5.2 루틴 편집 · 5.3 타이머 편집(축소 상태)
 *
 * 블록 1개 · 라운드 1이면 "라운드"·"종목"이라는 말이 어디에도 나오지 않는다.
 * 웜업·준비·쿨다운은 0으로 내리면 그 구간이 사라진다 — 별도 on/off 토글이 없다.
 */
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockList } from '../src/components/BlockList';
import { useDragAutoScroll } from '../src/components/useDragAutoScroll';
import { useToast } from '../src/components/Toast';
import { Chevron, Collapsible } from '../src/components/Collapsible';
import { ClearButton } from '../src/components/ClearButton';
import { BlockPickerSheet } from '../src/components/BlockPickerSheet';
import { BlockSheet } from '../src/components/BlockSheet';
import { useMiniTimerSpace, useTimerRunning } from '../src/components/MiniTimer';
import { SurfaceButton } from '../src/components/Buttons';
import { Surface } from '../src/components/Surface';
import { PressBox } from '../src/components/PressBox';
import { BackIcon, PlayIcon } from '../src/components/Icons';
import { InfoTip } from '../src/components/InfoTip';
import { Screen } from '../src/components/Screen';
import { ValueRow } from '../src/components/ValueRow';
import { t } from '../src/i18n';
import { durationLong, durationShort } from '../src/engine/labels';
import { totalSec, workSec } from '../src/engine/segments';
import { useSession } from '../src/session';
import { emptyPreset, uid, useStore } from '../src/store';
import { C, GUTTER, TABULAR } from '../src/theme';
import { kindOf, type Block, type Preset } from '../src/types';

/** 종목 추가와 저장 — 한 화면의 두 버튼이라 모서리를 한 값에 묶어둔다 */
const ACTION_RADIUS = 16;

/**
 * 손댄 것이 있는지 가리는 도장.
 *
 * 두 프리셋을 통째로 JSON으로 견주면 키 순서와 시각 도장(updatedAt·lastRunAt)에
 * 걸려 아무것도 안 고쳤는데 고쳤다고 나온다. 저장할 값만 정한 순서로 늘어놓는다.
 * 이름은 다듬어서 본다 — 뒤에 공백 하나 붙인 것을 편집으로 치지 않는다.
 */
function fingerprint(p: Preset): string {
  return JSON.stringify([
    p.name.trim(),
    p.warmupSec,
    p.prepareSec,
    p.blockRestSec,
    p.rounds,
    p.roundRestSec,
    p.cooldownSec,
    p.blocks.map((b) => [b.id, b.name.trim(), b.workSec, b.restSec, b.sets]),
  ]);
}

export default function Edit() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: 'routine' | 'timer' }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();
  const running = useTimerRunning();
  const session = useSession();
  const { getPreset, savePreset, settings, presets } = useStore();
  const toast = useToast();

  const initial = useMemo(
    () => getPreset(id) ?? emptyPreset(kind === 'timer' ? 'timer' : 'routine'),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [draft, setDraft] = useState<Preset>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ block: Block; isNew: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  const [startEndOpen, setStartEndOpen] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  // 종목을 끌어 옮기는 동안에는 화면이 같이 스크롤되면 안 된다
  const [reordering, setReordering] = useState(false);
  /** 종목을 화면 끝까지 끌면 목록이 따라 흐른다 */
  const auto = useDragAutoScroll();

  // 편집 화면의 모양은 저장된 종류를 따른다 — 종목이 1개라고 루틴이 타이머로 바뀌면 안 된다
  const simple = kindOf(draft) === 'timer';
  /** 가져올 수 있는 타이머 — 편집 중인 자기 자신은 뺀다 */
  const timers = useMemo(
    () => presets.filter((p) => p.id !== draft.id && kindOf(p) === 'timer' && p.blocks.length > 0),
    [presets, draft.id]
  );
  const total = totalSec(draft);
  const pure = workSec(draft);
  /** 저장하지 않은 편집이 남아 있는지 — 나가기와 시작하기가 이걸 보고 묻는다 */
  const dirty = useMemo(() => fingerprint(draft) !== fingerprint(initial), [draft, initial]);

  /**
   * 우리 손으로 떠나는 길 — 저장·시작처럼 이미 결론이 난 것들이다.
   *
   * 아래 문지기(usePreventRemove)는 router.back()에도 똑같이 걸린다. 저장하고
   * 나가는데 "버리고 나갈까요"를 묻게 되는 셈이라, 문지기를 먼저 내리고 그다음
   * 그림에서 떠난다. 내려간 값은 이번 그림이 끝나야 문지기에 닿기 때문이다.
   */
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const exit = (go: () => void) => setLeaving({ go });
  useEffect(() => {
    leaving?.go();
  }, [leaving]);

  /**
   * 나가려는 손을 붙잡는다 — 뒤로가기 버튼이든 밀어서 나가기든 같은 물음이다.
   *
   * 네이티브 스택에서 스와이프는 화면을 먼저 벗겨내고 JS에 알린다. beforeRemove를
   * 직접 듣고 막아도 이미 늦은 이유다. usePreventRemove는 막고 있다는 사실을
   * 화면까지(preventNativeDismiss) 내려보내서 벗겨지는 것 자체를 붙든다.
   */
  usePreventRemove(dirty && leaving == null, ({ data }) => {
    Alert.alert(t('edit.discardTitle'), t('edit.discardBody'), [
      { text: t('edit.discardStay'), style: 'cancel' },
      {
        text: t('edit.discardLeave'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const patch = (p: Partial<Preset>) => setDraft((d) => ({ ...d, ...p }));
  const toggleRow = (key: string) => {
    setOpen((o) => (o === key ? null : key));
    setTip(null);
  };
  const tipFor = (key: string) => ({
    tipOpen: tip === key,
    onTip: () => setTip((t) => (t === key ? null : key)),
  });

  /** 타이머(블록 1개)의 이름은 프리셋 이름과 같이 간다 — 실행 화면 제목이 그 이름이다 */
  const setName = (name: string) => {
    if (simple && draft.blocks[0]) {
      patch({ name, blocks: [{ ...draft.blocks[0], name }] });
    } else {
      patch({ name });
    }
  };

  const patchBlock0 = (p: Partial<Block>) => {
    const b = draft.blocks[0];
    if (!b) return;
    patch({ blocks: [{ ...b, ...p }] });
  };

  const newBlock = (): Block => ({
    id: uid(),
    name: t('defaults.blockName', { n: draft.blocks.length + 1 }),
    workSec: 30,
    restSec: 60,
    sets: 3,
  });

  const normalized = (): Preset => ({
    ...draft,
    name: draft.name.trim() || t(simple ? 'defaults.timerName' : 'defaults.routineName'),
    blocks: draft.blocks.map((b) => ({ ...b, name: b.name.trim() || t('defaults.block') })),
  });

  /** 이미 있던 것을 고친 것인지, 처음 만든 것인지 — 말이 달라야 한다 */
  const isNew = getPreset(draft.id) == null;

  const save = () => {
    savePreset(normalized());
    toast(t(isNew ? 'toast.saved' : 'toast.updated'));
    exit(() => router.back());
  };

  /** 나간다 — 고친 것이 남아 있으면 문지기가 묻는다 */
  const leave = () => router.back();

  /**
   * 편집 화면은 스택에서 걷어내고 홈 위에 실행 화면을 올린다. 실행 화면을 접었을 때
   * 방금 떠난 편집 화면이 도로 나타나면 안 된다 — 홈에서 ▶를 누른 것과 같아야 한다.
   * (실행 화면에서 편집으로 나갈 때 run.tsx가 하는 것과 같은 길이다.)
   */
  const goRun = () => {
    // 한 커밋에 묶이면 iOS가 모달 해제와 push를 겹쳐 처리하다 잔여 레이어를
    // 남긴다 — 그려지는데 터치만 안 먹는 화면이 된다. 프레임을 하나 띄운다.
    router.dismissTo('/');
    requestAnimationFrame(() => router.push('/run'));
  };

  /**
   * 고치던 것을 그대로 시작한다 — 저장 없이 실행하면 방금 만진 값이 아니라
   * 저장돼 있던 값이 돌기 때문에, 저장을 먼저 하고 그 프리셋을 건다.
   */
  const startNow = () => {
    const p = normalized();
    savePreset(p);
    session.start(p.id);
    exit(goRun);
  };

  /**
   * 도는 것을 보러 간다 — 고치던 것을 두고 떠나는 셈이라 남아 있으면 묻는다.
   * 문지기에게 맡기지 않고 여기서 묻는다 — goRun은 홈까지 걷어내고 실행 화면을
   * 얹는 두 걸음이라, 첫 걸음만 붙잡히면 두 번째가 엉뚱한 자리에 쌓인다.
   */
  const openRunning = () => {
    if (!dirty) {
      goRun();
      return;
    }
    Alert.alert(t('edit.discardTitle'), t('edit.discardBody'), [
      { text: t('edit.discardStay'), style: 'cancel' },
      { text: t('edit.discardLeave'), style: 'destructive', onPress: () => exit(goRun) },
    ]);
  };

  /**
   * ▶ — 홈의 행 ▶와 같은 규칙이다. 이미 도는 타이머가 있으면 그 자리에서
   * 갈아엎지 않는다.
   *
   * 지금 편집 중인 바로 그것이 돌고 있으면 화면만 연다. 다시 시작하면 진행이
   * 날아가고, 무엇보다 도는 프리셋을 저장으로 덮으면 계획이 발밑에서 바뀐다 —
   * 그래서 이 갈래에서는 저장하지 않는다.
   *
   * 다른 것이 돌고 있으면 무엇을 끝내고 무엇을 시작하는지 이름을 대고 묻는다.
   * 그때는 이 물음이 저장 여부까지 대신한다 — 되돌릴 수 없는 쪽이 더 큰 물음이라,
   * 창을 두 번 겹쳐 띄우지 않는다.
   */
  const askStart = () => {
    const onAir = running ? session.preset : null;

    if (onAir) {
      if (onAir.id === draft.id) {
        openRunning();
        return;
      }
      Alert.alert(
        t('run.switchTitle'),
        t('run.switchBody', { running: onAir.name, next: normalized().name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('run.switchConfirm'), style: 'destructive', onPress: startNow },
        ]
      );
      return;
    }

    /** 저장을 겸하는 버튼이라, 고친 것이 있으면 말없이 덮어쓰지 않는다 */
    if (!dirty) {
      startNow();
      return;
    }
    Alert.alert(t('edit.startSaveTitle'), t('edit.startSaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('edit.startSaveConfirm'), onPress: startNow },
    ]);
  };

  const startEndSummary = () => {
    const parts: string[] = [];
    if (draft.warmupSec > 0) parts.push(t('edit.warmupPart', { dur: durationShort(draft.warmupSec) }));
    if (draft.prepareSec > 0)
      parts.push(t('edit.preparePart', { dur: durationShort(draft.prepareSec) }));
    if (draft.cooldownSec > 0)
      parts.push(t('edit.cooldownPart', { dur: durationShort(draft.cooldownSec) }));
    if (parts.length === 0) return t('common.none');
    if (parts.length === 1) return t('edit.onlyOne', { item: parts[0] });
    return parts.join(' · ');
  };

  const startEndRows = (
    <>
      <ValueRow
        title={t('edit.warmup')}
        display={durationShort(draft.warmupSec) || t('common.none')}
        open={open === 'warmup'}
        onToggle={() => toggleRow('warmup')}
        wheel="time"
        value={draft.warmupSec}
        onChange={(warmupSec) => patch({ warmupSec })}
      />
      <ValueRow
        title={t('edit.prepare')}
        display={durationShort(draft.prepareSec) || t('common.none')}
        open={open === 'prepare'}
        onToggle={() => toggleRow('prepare')}
        wheel="time"
        value={draft.prepareSec}
        onChange={(prepareSec) => patch({ prepareSec })}
      />
      <ValueRow
        title={t('edit.cooldown')}
        display={durationShort(draft.cooldownSec) || t('common.none')}
        open={open === 'cooldown'}
        onToggle={() => toggleRow('cooldown')}
        wheel="time"
        value={draft.cooldownSec}
        onChange={(cooldownSec) => patch({ cooldownSec })}
      />
    </>
  );

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.topBar}>
          <PressBox
            onPress={leave}
            hitSlop={12}
            scaleTo={0.88}
            dim={0}
            accessibilityLabel={t('common.cancel')}
          >
            <BackIcon size={26} color={C.textSecondary} />
          </PressBox>
          <Text style={styles.topTitle}>{t(simple ? 'edit.titleTimer' : 'edit.titleRoutine')}</Text>
          {/*
            시작 — 하단에 버튼으로 두면 저장하기와 나란히 서서 어느 쪽이 이 화면의
            일인지 흐려진다. 저장은 아래, 실행은 위.

            타이머가 돌고 있어도 그대로 둔다. 도는 것이 지금 고치는 그것이면 이
            버튼이 그 화면으로 가는 길이 되고, 다른 것이면 무엇을 끝낼지 묻는다
            (askStart). 미니 바가 있다고 해서 여기를 비우면, 지금 보고 있는 이
            루틴을 어떻게 하겠다는 손잡이가 화면에서 사라진다.
          */}
          <PressBox
            onPress={askStart}
            haptic="commit"
            disabled={draft.blocks.length === 0}
            hitSlop={12}
            scaleTo={0.88}
            dim={0}
            accessibilityLabel={t('edit.start')}
          >
            {/* ▶는 속이 찬 삼각형이라 같은 치수면 획으로 그린 ‹보다 훨씬 크게 읽힌다 */}
            <PlayIcon size={18} />
          </PressBox>
        </View>

        <ScrollView
          {...auto.props}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!reordering}
          onScrollBeginDrag={() => setTip(null)}
        >
          <View style={styles.nameRow}>
            <Text style={styles.nameLabel}>{t('edit.name')}</Text>
            <View style={styles.nameInputRow}>
              <TextInput
                value={draft.name}
                onChangeText={setName}
                style={[styles.nameInput, { flex: 1 }]}
                placeholder={t(simple ? 'defaults.timerName' : 'defaults.routineName')}
                placeholderTextColor={C.textTertiary}
                selectionColor={C.textPrimary}
                maxLength={24}
                returnKeyType="done"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              {nameFocused && draft.name.length > 0 && <ClearButton onPress={() => setName('')} />}
            </View>
          </View>

          {simple ? (
            <>
              {/* 5.3 축소 상태 — 종목 목록도, 별도 시트도 없다 */}
              <ValueRow
                title={t('edit.work')}
                display={durationShort(draft.blocks[0]?.workSec ?? 0)}
                open={open === 'work'}
                onToggle={() => toggleRow('work')}
                wheel="time"
                value={draft.blocks[0]?.workSec ?? 0}
                onChange={(workSecV) => patchBlock0({ workSec: workSecV })}
                allowZero={false}
              />
              <ValueRow
                title={t('edit.rest')}
                display={durationShort(draft.blocks[0]?.restSec ?? 0) || t('common.none')}
                open={open === 'rest'}
                onToggle={() => toggleRow('rest')}
                wheel="time"
                value={draft.blocks[0]?.restSec ?? 0}
                onChange={(restSec) => patchBlock0({ restSec })}
              />
              <ValueRow
                title={t('edit.sets')}
                display={t('count.sets', { count: draft.blocks[0]?.sets ?? 1 })}
                open={open === 'sets'}
                onToggle={() => toggleRow('sets')}
                wheel="count"
                value={draft.blocks[0]?.sets ?? 1}
                onChange={(sets) => patchBlock0({ sets })}
                min={1}
                max={50}
                unit={t('edit.sets')}
              />

              <Pressable
                style={[styles.linkRow, tip === 'startEnd' && styles.raised]}
                onPress={() => {
                  setStartEndOpen((v) => !v);
                  setOpen(null);
                }}
              >
                <View style={styles.titleWrap}>
                  <Text style={styles.rowTitle}>{t('edit.startEndRow')}</Text>
                  <InfoTip text={t('tips.startEnd')} {...toInfoTip(tip, setTip, 'startEnd')} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.rowValueMuted, TABULAR]}>{startEndSummary()}</Text>
                  <Chevron open={startEndOpen} />
                </View>
              </Pressable>
              <Collapsible open={startEndOpen}>{startEndRows}</Collapsible>
            </>
          ) : (
            <>
              <Text style={styles.section}>{t('count.exercises', { count: draft.blocks.length })}</Text>
              <BlockList
                onDragActive={setReordering}
                blocks={draft.blocks}
                autoScroll={auto}
                onPress={(block) => setSheet({ block, isNew: false })}
                onReorder={(blocks) => patch({ blocks })}
              />
              <PressBox
                radius={ACTION_RADIUS}
                scaleTo={0.97}
                dim={0.22}
                style={{ marginTop: 12, marginBottom: 14 }}
                accessibilityLabel={t('edit.a11yAddBlock')}
                onPress={() => setPicking(true)}
              >
                <Surface radius={ACTION_RADIUS} style={styles.addBlock}>
                  <View style={styles.center}>
                    <Text style={styles.addBlockLabel}>{t('edit.addBlock')}</Text>
                  </View>
                </Surface>
              </PressBox>

              <Text style={styles.section}>{t('edit.repeat')}</Text>
              <ValueRow
                title={t('edit.rounds')}
                tip={t('tips.rounds')}
                {...tipFor('rounds')}
                display={t('count.rounds', { count: draft.rounds })}
                open={open === 'rounds'}
                onToggle={() => toggleRow('rounds')}
                wheel="count"
                value={draft.rounds}
                onChange={(rounds) => patch({ rounds })}
                min={1}
                max={20}
                unit={t('edit.rounds')}
                valueSize={21}
                chevron
              />
              <ValueRow
                title={t('edit.blockRest')}
                display={durationShort(draft.blockRestSec) || t('common.none')}
                open={open === 'blockRest'}
                onToggle={() => toggleRow('blockRest')}
                wheel="time"
                value={draft.blockRestSec}
                onChange={(blockRestSec) => patch({ blockRestSec })}
                valueSize={21}
                chevron
              />
              <ValueRow
                title={t('edit.roundRest')}
                display={durationShort(draft.roundRestSec) || t('common.none')}
                open={open === 'roundRest'}
                onToggle={() => toggleRow('roundRest')}
                wheel="time"
                value={draft.roundRestSec}
                onChange={(roundRestSec) => patch({ roundRestSec })}
                valueSize={21}
                chevron
              />

              <View style={[styles.sectionRow, tip === 'startEnd' && styles.raised]}>
                <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]}>{t('edit.startEnd')}</Text>
                <InfoTip text={t('tips.startEnd')} {...toInfoTip(tip, setTip, 'startEnd')} />
              </View>
              {startEndRows}
            </>
          )}

        </ScrollView>

        {/* 하단 고정 — 값을 바꾸는 내내 갱신된다 */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) + miniSpace }]}>
          <View style={styles.totals}>
            <Text style={[styles.totalText, TABULAR]}>{t('edit.totalTime', { time: durationLong(total) })}</Text>
            <Text style={[styles.totalText, TABULAR]}>{t('edit.workTime', { time: durationLong(pure) })}</Text>
          </View>
          <SurfaceButton
            label={t('common.save')}
            onPress={save}
            height={58}
            radius={ACTION_RADIUS}
          />
        </View>
      </View>

      <BlockPickerSheet
        visible={picking}
        timers={timers}
        onClose={() => setPicking(false)}
        onCreateNew={() => {
          setPicking(false);
          setSheet({ block: newBlock(), isNew: true });
        }}
        onPickTimer={(block) => {
          setPicking(false);
          // 가져온 값은 복사본이다 — 새 id를 줘야 원본 타이머와 얽히지 않는다
          patch({ blocks: [...draft.blocks, { ...block, id: uid() }] });
        }}
      />

      <BlockSheet
        block={sheet?.block ?? null}
        isNew={sheet?.isNew}
        canDelete={!sheet?.isNew && draft.blocks.length > 1}
        onClose={() => setSheet(null)}
        onSave={(b, alsoTimer) => {
          if (sheet?.isNew) patch({ blocks: [...draft.blocks, b] });
          else patch({ blocks: draft.blocks.map((x) => (x.id === b.id ? b : x)) });
          // 체크했으면 같은 값으로 타이머도 하나 만든다 — 다음 루틴에서 가져다 쓸 수 있게
          if (alsoTimer) {
            const now = Date.now();
            savePreset({
              id: uid(),
              kind: 'timer',
              name: b.name,
              warmupSec: 0,
              prepareSec: 10,
              blocks: [{ ...b, id: uid() }],
              blockRestSec: 30,
              rounds: 1,
              roundRestSec: 90,
              cooldownSec: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
          setSheet(null);
        }}
        onDelete={(bid) => {
          patch({ blocks: draft.blocks.filter((b) => b.id !== bid) });
          setSheet(null);
        }}
      />
    </Screen>
  );
}

function toInfoTip(
  tip: string | null,
  setTip: React.Dispatch<React.SetStateAction<string | null>>,
  key: string
) {
  return {
    open: tip === key,
    onToggle: () => setTip((t) => (t === key ? null : key)),
  };
}

const styles = StyleSheet.create({
  topBar: {
    height: 52,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: C.textPrimary },
  nameRow: {
    paddingTop: 10,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  nameLabel: { fontSize: 13, color: C.textTertiary },
  nameInputRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    padding: 0,
    letterSpacing: -0.44,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 10 },
  section: {
    marginTop: 40,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.78,
    color: C.textTertiary,
  },
  addBlock: { height: 52 },
  addBlockLabel: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  raised: { zIndex: 30, elevation: 30 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  rowTitle: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  rowValueMuted: { fontSize: 16, color: C.textSecondary },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    backgroundColor: 'rgba(10,10,12,0.6)',
  },
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalText: { fontSize: 16, color: C.textSecondary },
});
