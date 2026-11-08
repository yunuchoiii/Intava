/**
 * 공유 카드 고르기 — 완료 화면의 「공유하기」에서 전체 화면으로 올라온다(시안 TURN 4, 4a–4d).
 *
 * 카드 다섯 가지를 좌우로 넘겨 고른다. 가운데 카드는 실제 공유될 이미지 그대로(0.8배)이고,
 * 옆 카드가 흐리게 살짝 보여 넘길 수 있다는 걸 알려 준다. 사진 카드(3a·3c)는 사진이 있어야
 * 공유할 수 있다 — 사진이 없으면 사진 자리 가운데에 「사진 넣기」가 뜨고(카드를 누르면 열린다) 공유 버튼이 꺼진다.
 * 사진은 두 사진 카드가 함께 쓴다.
 *
 * 순서는 늘 기본 → 3a → 3c → 3d → 3e로 두고, **마지막으로 공유한 카드에서 시작한다**(그 카드가 가운데로 —
 * 순서를 바꾸면 매번 자리가 달라져 헷갈린다는 사용자 지적, 2026-11-03).
 */
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  PixelRatio,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { BackIcon, ShareIcon } from '../src/components/Icons';
import { PressBox } from '../src/components/PressBox';
import { coverSize, needsPhoto, PHOTO_SPOT, StoryCard, type StoryTemplate } from '../src/components/StoryCards';
import { ToastHost, useToast } from '../src/components/Toast';
import { ShareImage, SHARE_H, SHARE_W } from '../src/components/WorkoutCard';
import { t } from '../src/i18n';
import { load, save, useStore } from '../src/store';

type Kind = 'base' | StoryTemplate;

/** 시안의 기본 순서 */
const ORDER: Kind[] = ['base', 'photoStack', 'photoStrip', 'ringHero', 'typePoster'];
/** 마지막으로 공유한 카드 */
const KEY_LAST = 'intava:storyTemplate';

const NAME: Record<Kind, string> = {
  base: 'shareCard.base',
  photoStack: 'shareCard.photoStack',
  photoStrip: 'shareCard.photoStrip',
  ringHero: 'shareCard.ringHero',
  typePoster: 'shareCard.typePoster',
};

/** 카드는 0.8배(288×512). 옆 카드는 흐리게만 한다 */
const SCALE = 0.8;
const CARD_W = SHARE_W * SCALE;
const CARD_H = SHARE_H * SCALE;
/**
 * 카드 한 칸 — 12pt 띄워 나란히. 시안(4a)은 옆 카드를 0.85배로 줄였지만, 스크롤에 맞춰 크기를
 * 바꾸면(native scale 애니메이션) 넘겨 온 카드의 글자가 계단처럼 깨졌다(실측: 크기만 빼면 선명,
 * 투명도는 무관, 2026-11-03). 그래서 크기는 고정하고 투명도만 바꾼다.
 */
const STEP = CARD_W + 12;
/** 사진 카드에서 숫자 · 글자 묶음이 시작하는 높이(카드 좌표) — 여기 아래에서 시작한 끌기는 카드 넘기기로 */
const INFO_TOP = 400;
/**
 * 카드 아래 칸 — 위 여백 16 + 점 6 + 12 + 안내 문구 24(위 6 + 줄 18). 사진 바꾸기(38)는 14만큼 아래로
 * 넘치지만 absolute라 자리를 밀지 않는다. 문구 기준으로 잡아야 문구~버튼 간격이 헤더~카드 간격과 맞는다.
 */
const BELOW_H = 16 + 6 + 12 + 24;

const SHOT = {
  format: 'png' as const,
  width: 1080 / PixelRatio.get(),
  height: 1920 / PixelRatio.get(),
  result: 'tmpfile' as const,
};
/** iOS 공유 창의 「이미지 저장」 */
const SAVE_TO_PHOTOS = 'com.apple.UIKit.activity.SaveToCameraRoll';

/**
 * 전체 화면 모달은 앱 바닥의 ToastHost를 덮는다 — 「이미지를 저장했어요」가 모달 뒤에 떠서 안 보였다.
 * 이 화면 안에 따로 두고, 아래 버튼(56) 위로 띄운다.
 */
export default function ShareCardScreen() {
  return (
    <ToastHost lift={60}>
      <ShareCard />
    </ToastHost>
  );
}

function ShareCard() {
  const { record } = useLocalSearchParams<{ record?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { records } = useStore();
  const toast = useToast();
  const entry = useMemo(() => records.find((r) => r.id === record), [record, records]);

  /** 처음 가운데에 둘 카드 — 마지막으로 공유한 것. 불러오기 전엔 null */
  const [start, setStart] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const order = ORDER;
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | undefined>();
  /*
    사진 확대 · 위치 — 사진 카드 두 장과 찍는 카드가 같은 값을 쓴다(공유 이미지 = 보이는 그대로).
    두 손가락으로 벌리면 커지고(1~4배), 커진 상태에서만 한 손가락으로 끌어 옮긴다 — 확대하지 않았을
    때는 끌기가 꺼져 있어 좌우로 넘기면 다음 카드로 간다. 사진이 카드 밖으로 빠져 빈 곳이 생기지
    않게 옮길 수 있는 거리를 막는다(사용자 요청 2026-11-08).
  */
  const frame = useRef({
    scale: new Animated.Value(1),
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }).current;
  const z = useRef({ s: 1, x: 0, y: 0, s0: 1, x0: 0, y0: 0 }).current;
  const [zoomed, setZoomed] = useState(false);
  const setFrame = useCallback(
    (sc: number, x: number, y: number) => {
      const size = photo ? coverSize(photo.width, photo.height) : { w: SHARE_W, h: SHARE_H };
      const mx = Math.max(0, (size.w * sc - SHARE_W) / 2);
      const my = Math.max(0, (size.h * sc - SHARE_H) / 2);
      z.s = sc;
      z.x = Math.min(mx, Math.max(-mx, x));
      z.y = Math.min(my, Math.max(-my, y));
      frame.scale.setValue(z.s);
      frame.x.setValue(z.x);
      frame.y.setValue(z.y);
    },
    [photo, frame, z]
  );
  // 새 사진이면 처음(가운데 · 1배)부터
  useEffect(() => {
    setFrame(1, 0, 0);
    setZoomed(false);
  }, [photo, setFrame]);
  /*
    카드마다 따로 만들고 가운데 카드에서만 켠다. 가운데 카드에만 GestureDetector를 붙였더니 넘길 때마다
    카드가 다른 모양으로 다시 만들어져 사진이 깜빡였다(사용자 지적) — 구조는 늘 같게, 켜고 끄기만 바꾼다.
  */
  const gestureFor = useCallback((on: boolean) => {
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .enabled(on)
      .onStart(() => {
        z.s0 = z.s;
      })
      .onUpdate((e) => setFrame(Math.min(4, Math.max(1, z.s0 * e.scale)), z.x, z.y))
      .onEnd(() => setZoomed(z.s > 1.01));
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(on && zoomed)
      /*
        아래쪽 숫자 · 글자 영역에서는 끌기가 시작조차 하지 않게 잡는 영역을 위로 줄인다 — 확대한 채로도
        그 자리를 잡고 밀면 옆 카드로 넘어가게(사용자 요청). onTouchesDown에서 JS로 판정해 fail()하던
        방식은 판정이 늦어 실기기에서 듣지 않았다. 값은 카드 좌표(360×640, 이 뷰의 자기 좌표)다.
      */
      .hitSlop({ bottom: -(SHARE_H - INFO_TOP) })
      .onStart(() => {
        z.x0 = z.x;
        z.y0 = z.y;
      })
      // 화면은 카드를 0.8배로 보여 준다 — 손가락이 움직인 만큼 카드 좌표로는 1/0.8
      .onUpdate((e) => setFrame(z.s, z.x0 + e.translationX / SCALE, z.y0 + e.translationY / SCALE));
    return Gesture.Simultaneous(pinch, pan);
  }, [zoomed, setFrame, z]);
  const framed = photo ? { ...photo, frame } : undefined;
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);
  const shot = useRef<View>(null);

  useEffect(() => {
    void load<Kind | null>(KEY_LAST, null).then((last) => {
      const i = last ? Math.max(0, ORDER.indexOf(last)) : 0;
      scrollX.setValue(i * STEP);
      setIndex(i);
      setStart(i);
    });
  }, [scrollX]);

  const kind = order[index] ?? 'base';
  const blocked = kind !== 'base' && needsPhoto(kind) && !photo;

  const pick = async (from: 'album' | 'camera') => {
    setPicking(false);
    // 시트가 닫히는 중에 iOS 선택 창을 띄우면 뜨지 않는다 — 닫힘이 끝날 때까지 기다린다
    await new Promise((r) => setTimeout(r, 350));
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('shareCard.cameraDeniedTitle'), t('shareCard.cameraDeniedBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('shareCard.openSettings'), onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
      }
      const res =
        from === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const a = res.canceled ? undefined : res.assets?.[0];
      if (a?.uri) setPhoto({ uri: a.uri, width: a.width || SHARE_W, height: a.height || SHARE_H });
    } catch {
      // 고르다 만 것 — 그대로 둔다
    }
  };

  const share = async () => {
    if (!shot.current || sharing || blocked) return;
    setSharing(true);
    try {
      const uri = await captureRef(shot, SHOT);
      const res = await Share.share({ url: uri });
      if (res.action === Share.sharedAction) {
        void save(KEY_LAST, kind);
        if (res.activityType === SAVE_TO_PHOTOS) toast(t('doneScreen.imageSaved'));
      }
    } catch {
      Alert.alert(t('doneScreen.shareFailTitle'), t('doneScreen.shareFailBody'));
    } finally {
      setSharing(false);
    }
  };

  if (!entry || start == null) return <View style={styles.root} />;

  const side = (width - CARD_W) / 2;
  const bottomPad = Math.max(insets.bottom - 4, 16);

  return (
    <View style={styles.root}>
      {/* 찍을 카드 — 실제 크기로 바탕 뒤에 깔아 둔다(찍을 때는 가려져 있어도 된다) */}
      <View style={styles.hidden} pointerEvents="none">
        {kind === 'base' ? (
          <ShareImage ref={shot} record={entry} />
        ) : (
          <StoryCard ref={shot} template={kind} record={entry} photo={framed} />
        )}
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0D' }]} />

      <View style={[styles.header, { marginTop: insets.top }]}>
        {/* 이전 — 아래 「닫기」와 같은 일. 다른 화면처럼 왼쪽 위에서도 나갈 수 있게(사용자 요청) */}
        <PressBox
          onPress={() => router.back()}
          hitSlop={10}
          scaleTo={0.9}
          dim={0}
          outerStyle={styles.back}
          style={styles.backBox}
          accessibilityLabel={t('common.close')}
        >
          <BackIcon size={26} color="#B5B8BE" />
        </PressBox>
        <Text style={styles.title}>{t('shareCard.title')}</Text>
      </View>

      {/*
        카드 + 그 아래(점 · 사진 바꾸기 또는 안내 문구) 한 덩어리를 헤더와 버튼 사이 한가운데에 둔다
        (사용자 지적 2026-11-03). 아래 칸 높이는 고정한다(BELOW_H) — 카드마다 버튼·문구·없음이
        바뀌어도 카드가 위아래로 흔들리지 않게.
      */}
      <View style={{ flex: 1, justifyContent: 'center', marginBottom: 16 + 56 + bottomPad }}>
        <View style={{ height: CARD_H + BELOW_H }}>
          <Animated.FlatList
            ref={listRef}
            data={order}
            keyExtractor={(k) => k}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={STEP}
            contentOffset={{ x: start * STEP, y: 0 }}
            getItemLayout={(_, i) => ({ length: STEP, offset: STEP * i, index: i })}
            decelerationRate="fast"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: side - (STEP - CARD_W) / 2 }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
              useNativeDriver: true,
              listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / STEP);
                if (i !== index && i >= 0 && i < order.length) setIndex(i);
              },
            })}
            scrollEventThrottle={16}
            renderItem={({ item, index: i }) => {
              const range = [(i - 1) * STEP, i * STEP, (i + 1) * STEP];
              const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
              const empty = item !== 'base' && needsPhoto(item) && !photo;
              return (
                <Animated.View style={{ width: STEP, height: CARD_H, alignItems: 'center', opacity }}>
                  <Pressable
                    // 옆 카드를 누르면 그 카드를 가운데로(사용자 요청), 가운데의 빈 사진 카드는 사진 넣기
                    disabled={i === index && !empty}
                    onPress={() => {
                      if (i !== index) listRef.current?.scrollToOffset({ offset: i * STEP, animated: true });
                      else setPicking(true);
                    }}
                    style={styles.card}
                    accessibilityLabel={empty ? t('shareCard.addPhoto') : t(NAME[item])}
                  >
                    {item !== 'base' && needsPhoto(item) ? (
                      <GestureDetector gesture={gestureFor(!!photo && i === index)}>
                        <View style={styles.cardInner}>
                          <StoryCard template={item} record={entry} photo={framed} />
                        </View>
                      </GestureDetector>
                    ) : (
                      <View style={styles.cardInner}>
                        {item === 'base' ? (
                          <ShareImage record={entry} />
                        ) : (
                          <StoryCard template={item} record={entry} photo={framed} />
                        )}
                      </View>
                    )}
                    {empty && (
                      // 카드 전체가 아니라 사진이 들어갈 빈 자리 가운데에
                      <View style={[styles.addSpot, { height: PHOTO_SPOT[item as keyof typeof PHOTO_SPOT] * 2 * SCALE }]}>
                        <AddPhotoIcon />
                        <Text style={styles.addTitle}>{t('shareCard.addPhoto')}</Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            }}
          />

          <View style={[styles.below, { position: 'absolute', top: CARD_H, left: 0, right: 0 }]}>
            <View style={styles.dots}>
              {order.map((k, i) => (
                <View key={k} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
            {kind !== 'base' && needsPhoto(kind) &&
              (photo ? (
                <PressBox onPress={() => setPicking(true)} radius={18} scaleTo={0.96} dim={0.12} dimColor="#FFF" style={styles.pill}>
                  <RefreshIcon />
                  <Text style={styles.pillText}>{t('shareCard.changePhoto')}</Text>
                </PressBox>
              ) : (
                <Text style={styles.hint}>{t('shareCard.needPhoto')}</Text>
              ))}
          </View>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: bottomPad }]}>
        <PressBox onPress={() => router.back()} radius={18} scaleTo={0.97} dim={0.12} dimColor="#FFF" outerStyle={{ flex: 1 }} style={styles.close}>
          <Text style={styles.closeText}>{t('common.close')}</Text>
        </PressBox>
        <PressBox
          onPress={share}
          disabled={blocked || sharing}
          haptic="tap"
          radius={18}
          scaleTo={0.97}
          dim={0.14}
          outerStyle={{ flex: 1.6 }}
          style={[styles.shareBtn, blocked && styles.shareOff]}
          accessibilityLabel={t('doneScreen.share')}
        >
          <ShareIcon color={blocked ? '#5E6168' : '#0A0A0D'} />
          <Text style={[styles.shareText, blocked && { color: '#5E6168' }]}>{t('doneScreen.share')}</Text>
        </PressBox>
      </View>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.dim} onPress={() => setPicking(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={styles.grab} />
          <Text style={styles.sheetTitle}>{t('shareCard.addPhoto')}</Text>
          <PressBox onPress={() => void pick('album')} radius={16} scaleTo={0.98} dim={0.1} dimColor="#FFF" style={[styles.option, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <AlbumIcon />
            <Text style={styles.optionText}>{t('shareCard.pickAlbum')}</Text>
          </PressBox>
          <PressBox onPress={() => void pick('camera')} radius={16} scaleTo={0.98} dim={0.1} dimColor="#FFF" style={styles.option}>
            <CameraIcon />
            <Text style={styles.optionText}>{t('shareCard.takePhoto')}</Text>
          </PressBox>
          <Pressable onPress={() => setPicking(false)} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ---- 아이콘(시안의 24 격자 선 아이콘) ---------------------------------------------

/** 사진 + 더하기 — 사진 넣기 */
function AddPhotoIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3.5H7A3.5 3.5 0 0 0 3.5 7v10A3.5 3.5 0 0 0 7 20.5h10a3.5 3.5 0 0 0 3.5-3.5v-5.5" />
      <Circle cx={8.6} cy={8.6} r={1.8} />
      <Path d="M5.5 20.3l8.1-8.1a1.6 1.6 0 0 1 2.3 0l4.4 4.4" />
      <Path d="M15.5 5.5h6M18.5 2.5v6" />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <Path d="M20 4v5h-5" />
    </Svg>
  );
}

function AlbumIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={18} height={18} rx={4} />
      <Circle cx={9} cy={9} r={1.8} />
      <Path d="M21 15.5l-5-5L5 21" />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
      <Circle cx={12} cy={13} r={3.6} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0D' },
  hidden: { position: 'absolute', top: 0, left: 0 },
  header: { height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 44 },
  backBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.32, color: '#F7F7F8' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0A0A0D',
  },
  cardInner: { width: SHARE_W, height: SHARE_H, transform: [{ scale: SCALE }], transformOrigin: 'top left' },
  addSpot: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  addTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.4, color: '#F7F7F8' },
  below: { marginTop: 16, alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 18, backgroundColor: '#F7F7F8' },
  hint: { marginTop: 6, fontSize: 13, fontWeight: '500', color: '#8C9098' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    marginTop: 2,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: { fontSize: 13.5, fontWeight: '600', color: '#F7F7F8' },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 24, flexDirection: 'row', gap: 10 },
  close: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeText: { fontSize: 16, fontWeight: '700', color: '#F7F7F8' },
  shareBtn: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F7F7F8' },
  shareOff: { backgroundColor: 'rgba(255,255,255,0.08)' },
  shareText: { fontSize: 16, fontWeight: '700', color: '#0A0A0D' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#1C1C20',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  sheetTitle: { alignSelf: 'center', marginTop: 10, marginBottom: 8, fontSize: 15, fontWeight: '700', letterSpacing: -0.3, color: '#F7F7F8' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 58, paddingHorizontal: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#F7F7F8' },
  cancel: { height: 52, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#9A9EA6' },
});
