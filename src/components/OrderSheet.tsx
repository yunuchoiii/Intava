/**
 * 운동 및 순서 편집 — 실행 중에 종목을 고치고, 남은 차례를 바꾸고, 오늘 안 할 것을 뺀다.
 *
 * 행을 누르면 그 종목의 이름·운동·휴식·세트·메모를 고친다(편집 화면과 같은 시트).
 * 고친 것은 **이 운동에만** 들어가고 루틴은 그대로다 — 남길지는 완료 화면이 묻는다.
 * 지나간 종목도 고칠 수 있다. 이번 운동에는 이미 지났지만 루틴에 남길 값일 수 있다.
 *
 * 지나간 종목과 지금 하고 있는 종목은 위에 흐리게 굳어 있다. 세션은 흐른 시간을
 * 구간 배열에 대입해 지금 자리를 찾기 때문에, 지나간 배치가 바뀌면 그 자리가
 * 어긋난다 — 못 옮기는 것이 아니라 옮기면 안 되는 것이다. 빼기도 같은 이유로
 * 굳은 행에서는 잠긴다.
 *
 * **뺀 종목은 목록에서 사라지지 않는다.** 제자리에 흐리게 남아 체크만 꺼진다.
 * 사라지면 다시 넣을 자리가 없다.
 *
 * 끄는 몸짓은 편집 화면의 목록과 같은 것을 쓴다(BlockList). 한 화면에서만 되는
 * 손짓을 따로 만들면 둘 중 하나는 반드시 뒤처진다.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockList } from './BlockList';
import { PressBox } from './PressBox';
import { Surface } from './Surface';
import { Sheet } from './Sheet';
import { useDragAutoScroll } from './useDragAutoScroll';
import { t } from '../i18n';
import { C, GUTTER } from '../theme';
import type { Block } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 이 라운드의 차례대로 늘어놓은 종목 — 뺀 것도 들어 있다 */
  blocks: Block[];
  /** 앞에서 이만큼은 굳었다 */
  lockedCount: number;
  /** 그중 이번에 빼기로 한 종목의 id */
  skipped: string[];
  onReorder: (ids: string[]) => void;
  onSkipped: (ids: string[]) => void;
  /** 체크로 뺄 수 있는 종목인가 — 덧붙인 종목은 빼는 대상이 아니다(라운드에 속하지 않는다) */
  canSkip?: (block: Block) => boolean;
  /** 행을 눌렀다 — 그 종목을 고치는 시트를 연다 */
  onEdit: (block: Block) => void;
  /** 맨 아래 「종목 추가」 — 이번 운동에만 더한다 */
  onAdd: () => void;
  /** 더할 자리가 있는가 — 쿨다운·다 끝난 자리에서는 흐리게 둔다 */
  canAdd: boolean;
  /** 지금 하고 있는 종목 — 이름 옆에 「운동 중」 */
  currentId?: string;
  /** 완전히 내려간 뒤 — 미뤄둔 일을 여기서 처리한다 (RunMoreSheet와 같은 규칙) */
  onClosed?: () => void;
};

export function OrderSheet({
  visible,
  onClose,
  blocks,
  lockedCount,
  skipped,
  onReorder,
  onSkipped,
  onEdit,
  onAdd,
  canAdd,
  currentId,
  canSkip,
  onClosed,
}: Props) {
  const insets = useSafeAreaInsets();
  // 끌고 있는 동안 목록이 같이 스크롤되면 손가락과 행이 서로 밀린다.
  // 손가락을 끝까지 밀었을 때 흐르는 것은 이것과 다르다 — 그건 아래 autoScroll이 한다.
  const [dragging, setDragging] = useState(false);
  const auto = useDragAutoScroll();
  /*
    `if (!visible) return null`을 두지 않는다. 그러면 Sheet가 그 자리에서 통째로
    사라져 내려가는 애니메이션도, 다 내려갔다는 신호(onClosed)도 없다 — 이 시트가
    내려간 뒤에 이어서 할 일이 영영 오지 않는다. 떠 있지 않을 때 Modal을 걷는
    일은 Sheet가 스스로 한다.
  */

  const remaining = blocks.filter((b) => !skipped.includes(b.id));

  const toggle = (id: string) =>
    onSkipped(
      skipped.includes(id) ? skipped.filter((x) => x !== id) : [...skipped, id]
    );

  return (
    <Sheet visible={visible} onClose={onClose} onClosed={onClosed}>
      <Text style={styles.title}>{t('run.orderTitle')}</Text>
      <Text style={styles.note}>{t('run.orderNote')}</Text>

      <ScrollView
        {...auto.props}
        style={{ maxHeight: 460 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8 }}
        scrollEnabled={!dragging}
        showsVerticalScrollIndicator={false}
      >
        <BlockList
          blocks={blocks}
          lockedCount={lockedCount}
          onDragActive={setDragging}
          onPress={onEdit}
          showHandle
          currentId={currentId}
          autoScroll={auto}
          onReorder={(next) => onReorder(next.map((b) => b.id))}
          skipped={skipped}
          onToggleSkip={toggle}
          /*
            마지막 하나는 못 뺀다. 종목이 하나도 없는 라운드는 계획에 구멍을 내고,
            "운동을 그만두겠다"는 뜻이라면 그 길은 ✕이지 이 체크박스가 아니다.
            도로 넣는 것은 언제나 된다.
          */
          canToggleSkip={(b) =>
            canSkip?.(b) !== false && (skipped.includes(b.id) || remaining.length > 1)
          }
        />

        {/*
          맨 아래 — 편집 화면의 「종목 추가」와 같은 모양이다. 여기서 더한 것은
          이번 운동에만 들어가고, 루틴에 남길지는 완료 화면에서 묻는다.
        */}
        <PressBox
          radius={16}
          scaleTo={0.97}
          dim={0.22}
          disabled={!canAdd}
          style={[{ marginTop: 12 }, !canAdd && { opacity: 0.38 }]}
          accessibilityLabel={t('edit.a11yAddBlock')}
          onPress={onAdd}
        >
          <Surface radius={16} style={styles.add}>
            <View style={styles.center}>
              <Text style={styles.addLabel}>{t('edit.addBlock')}</Text>
            </View>
          </Surface>
        </PressBox>
      </ScrollView>

      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  add: { height: 52 },
  addLabel: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.textPrimary,
  },
  note: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 14,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSecondary,
  },
});
