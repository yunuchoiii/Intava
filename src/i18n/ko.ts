/**
 * 한국어 — 기준 카탈로그.
 *
 * 다른 언어는 이 구조를 그대로 따른다. 문장을 쪼개 이어붙이지 않고 통째로 두는 것이
 * 원칙이다. "3 / 8 세트"는 영어에서 "Set 3 of 8"로 어순이 바뀌기 때문에,
 * 조각을 코드에서 합치면 어떤 언어에서도 자연스러운 문장이 나오지 않는다.
 */
export const ko = {
  common: {
    cancel: '취소',
    save: '저장',
    close: '닫기',
    delete: '삭제',
    done: '완료',
    clear: '지우기',
    none: '없음',
  },

  /** 시간 표기 — 숫자와 단위의 순서·간격이 언어마다 다르다 */
  duration: {
    minSec: '{{m}}분 {{s}}초',
    minZero: '{{m}}분 0초',
    min: '{{m}}분',
    sec: '{{s}}초',
  },

  /**
   * 개수 — 영어는 단·복수가 갈리므로 i18next의 복수 규칙(_one/_other)을 쓴다.
   * 한국어·일본어·중국어는 형태가 하나뿐이라 두 칸에 같은 문장을 둔다.
   */
  count: {
    sets_one: '{{count}}세트',
    sets_other: '{{count}}세트',
    rounds_one: '{{count}}라운드',
    rounds_other: '{{count}}라운드',
    blocks_one: '{{count}}종목',
    blocks_other: '{{count}}종목',
    exercises_one: '종목 {{count}}개',
    exercises_other: '종목 {{count}}개',
  },

  home: {
    tabRoutine: '루틴 · {{count}}',
    tabTimer: '타이머 · {{count}}',
    newRoutine: '새 루틴',
    newTimer: '새 타이머',
    settings: '설정',
    emptyRoutineTitle: '아직 루틴이 없습니다',
    emptyRoutineBody: '종목과 라운드를 정해두면\n화면을 보지 않아도 순서대로 알려줍니다.',
    emptyTimerTitle: '아직 타이머가 없습니다',
    emptyTimerBody: '운동·휴식·세트만 정하면 됩니다.\n한 동작을 반복하는 단순 타이머입니다.',
    a11yEdit: '{{name}} 편집',
    a11yStart: '{{name}} 바로 실행',
    /** 루틴 행 요약 — "스쿼트 · 푸시업 · 플랭크 · 2라운드" */
    routineSummary: '{{names}} · {{rounds}}',
    /** 타이머 행 요약 — "20초 운동 · 10초 휴식 · 8세트" */
    timerSummary: '{{work}} 운동 · {{rest}} 휴식 · {{sets}}',
    noBlocks: '종목 없음',
    warmupPart: '웜업 {{dur}}',
    cooldownPart: '쿨다운 {{dur}}',
  },

  edit: {
    titleRoutine: '루틴 편집',
    titleTimer: '타이머 편집',
    name: '이름',
    addBlock: '＋ 종목 추가',
    a11yAddBlock: '종목 추가',
    repeat: '반복',
    rounds: '라운드',
    blockRest: '종목 사이 휴식',
    roundRest: '라운드 사이 휴식',
    startEnd: '시작 · 마무리',
    startEndRow: '웜업 · 준비 · 쿨다운',
    warmup: '웜업',
    prepare: '준비',
    cooldown: '쿨다운',
    skipLastRest: '마지막 휴식 생략',
    alerts: '알림',
    alertsRow: '소리 · 진동 · 카운트다운',
    allOn: '모두 켜짐',
    allOff: '모두 꺼짐',
    someOn: '{{count}}개 켜짐',
    work: '운동',
    rest: '휴식',
    sets: '세트',
    totalTime: '총 {{time}}',
    workTime: '운동 {{time}}',
    /** 웜업·준비·쿨다운 요약이 하나뿐일 때 — "준비 10초만" */
    onlyOne: '{{item}}만',
    warmupPart: '웜업 {{dur}}',
    preparePart: '준비 {{dur}}',
    cooldownPart: '쿨다운 {{dur}}',
    /** 종목 행 요약 — "30초 운동 · 1분 휴식 · 3세트" */
    blockSummary: '{{work}} 운동 · {{rest}} 휴식 · {{sets}}',
    a11yReorder: '{{name}} 순서 바꾸기',
    a11yEditBlock: '{{name}} 편집',
  },

  sheet: {
    blockName: '종목 이름',
    blockNamePlaceholder: '종목 이름',
    work: '운동',
    setRest: '세트 사이 휴식',
    sets: '세트',
    alsoSaveAsTimer: '내 타이머로도 저장',
    a11yDelete: '종목 삭제',
  },

  backup: {
    data: '데이터',
    export: '내보내기',
    exportNote: '루틴과 설정을 파일 하나로 저장합니다.',
    import: '불러오기',
    importNote: '내보낸 파일에서 되돌립니다. 같은 루틴은 덮어씁니다.',
    failTitle: '내보내지 못했습니다',
    failBody: '이 기기에서는 파일을 공유할 수 없습니다.',
    badTitle: '읽을 수 없는 파일',
    badBody: '인타바에서 내보낸 파일이 아닙니다.',
    askTitle: '불러올까요?',
    askBody: '루틴 {{count}}개와 설정을 가져옵니다. 이름이 같아도 다른 루틴이면 따로 추가됩니다.',
    doneTitle: '불러왔습니다',
    doneBody: '루틴 {{count}}개를 가져왔습니다.',
  },
  settings: {
    title: '설정',
    alerts: '알림',
    sound: '소리',
    soundNote: '구간이 바뀔 때 알림음을 냅니다.',
    vibration: '진동',
    vibrationNote: '구간마다 다른 패턴으로 울립니다.',
    countdown: '마지막 3초 카운트다운',
    countdownNote: '각 구간이 끝나기 3초 전부터 짧은 틱이 울립니다.',
    push: '푸시 알림',
    pushNote: '앱이 완전히 멈춰도 구간 전환을 알려줍니다.',
    app: '앱',
    version: '버전',
    language: '언어',
    languageNote: 'iOS 설정에서 이 앱의 언어를 바꿉니다.',
    volume: '볼륨',
    volumeLabel: '알림음 크기',
    screen: '화면',
    keepAwake: '실행 중 화면 꺼짐 방지',
  },

  run: {
    exitTitle: '운동을 끝낼까요?',
    exitBody: '지금까지의 진행은 저장되지 않습니다.',
    exitContinue: '계속하기',
    exitConfirm: '종료',
    a11yBack: '뒤로',
    a11yExit: '운동 종료',
    a11yEdit: '루틴 편집',
    a11ySound: '소리 · 진동 설정',
    pause: '일시정지',
    resume: '재개',
    next: '다음 · {{what}}',
    titleWithDur: '{{phase}} {{dur}}',
    switchTitle: '이미 실행 중입니다',
    switchBody: "'{{running}}'을(를) 끝내고 '{{next}}'을(를) 시작할까요?",
    switchConfirm: '끝내고 시작',
    prevRestart: '다시 처음',
    elapsed: '{{time}} 경과',
    total: '총 {{time}}',
  },

  phase: {
    WARMUP: '웜업',
    PREPARE: '준비',
    WORK: '운동',
    SET_REST: '휴식',
    BLOCK_REST: '종목 전환',
    ROUND_REST: '라운드 휴식',
    COOLDOWN: '쿨다운',
    DONE: '완료',
    paused: '일시정지',
  },

  /** 링 안쪽 아래 줄 */
  sub: {
    warmup: '가볍게 몸을 풉니다',
    cooldown: '마무리 스트레칭',
    prepare: '곧 시작합니다',
    roundRest: '{{round}}라운드 완료 · 다음 라운드',
    blockRest: '{{round}} / {{rounds}} 라운드 · {{nth}}번째 종목',
    setsOnly: '{{set}} / {{sets}} 세트',
    setsRounds: '{{set}} / {{sets}} 세트 · {{round}} / {{rounds}} 라운드',
    finished: '수고하셨습니다',
  },

  /** 다음 구간 예고 */
  segment: {
    work: '운동 {{dur}}',
    prepare: '준비 {{dur}}',
    warmup: '웜업 {{dur}}',
    cooldown: '쿨다운 {{dur}}',
    blockRest: '종목 전환 {{dur}}',
    roundRest: '라운드 휴식 {{dur}}',
    setRest: '휴식 {{dur}}',
    none: '운동 완료',
  },

  /** 「다음」 버튼 라벨 — 도착할 구간 */
  jump: {
    none: '완료로',
    withSet: '{{name}} · {{set}}세트',
  },

  doneScreen: {
    title: '운동 완료',
    summaryRoutine: '{{name}} · {{blocks}} {{rounds}} · {{sets}}',
    summaryTimer: '{{name}} · {{sets}}',
    withExtra: '{{summary}} · {{extra}} 포함',
    warmup: '웜업',
    cooldown: '쿨다운',
    totalTime: '총 시간',
    pureWork: '순수 운동',
    completedRounds: '완료 라운드',
    completedSets: '완료 세트',
    again: '다시 하기',
    home: '홈으로',
  },

  notify: {
    channelCue: '웜업 · 준비',
    channelWork: '운동 시작',
    channelRest: '세트 휴식',
    channelBlock: '종목 전환',
    channelRound: '라운드 휴식',
    channelCooldown: '쿨다운',
    channelDone: '운동 완료',
    workTitle: '운동 {{dur}}',
    bodySets: '{{set}} / {{sets}}세트',
    bodySetsRounds: '{{set}} / {{sets}}세트 · {{round}} / {{rounds}}라운드',
    bodyNext: '다음 · {{what}}',
    doneTitle: '운동 완료',
    doneBody: '{{name}} · 수고하셨습니다',
  },

  tips: {
    rounds:
      '종목 전체를 몇 바퀴 돌지 정합니다. 세트는 한 종목 안에서의 반복이고, 라운드는 종목 전체의 반복입니다.',
    startEnd:
      '세 구간 모두 0으로 내리면 사라집니다. 실행 중에는 웜업이 **주황**, 준비가 **앰버**, 쿨다운이 **회색빛 파랑** 화면으로 보입니다.',
    skipLastRest: '맨 마지막 세트가 끝나면 휴식 없이 바로 마칩니다.',
    volume: '음악을 줄이지 않고 알림음만 겹쳐 재생합니다.',
    keepScreenOn: '이 앱은 화면이 꺼진 채로 쓰이는 것을 정상으로 봅니다.',
  },

  list: {
    sortRecent: '최근 실행순',
    sortName: '이름순',
    sortCreated: '등록순',
    sortTitle: '정렬',
    actions: '{{name}}',
    duplicate: '복제',
    duplicateSuffix: '{{name}} 사본',
    duplicateNumbered: '{{base}} {{n}}',
    deleteConfirmTitle: '{{name}}을(를) 삭제할까요?',
    deleteConfirmBody: '되돌릴 수 없습니다.',
    a11yMore: '{{name}} 더보기',
  },

  pickBlock: {
    title: '종목 추가',
    fromTimer: '만들어 둔 타이머에서 가져오기',
    newBlock: '＋ 새 종목 만들기',
    empty: '가져올 타이머가 없습니다',
  },

  seed: {
    circuit: '전신 서킷',
    squat: '스쿼트',
    pushup: '푸시업',
    plank: '플랭크',
    tabata: '타바타',
  },

  defaults: {
    routineName: '새 루틴',
    timerName: '새 타이머',
    blockName: '종목 {{n}}',
    block: '종목',
  },
};

/** 다른 언어 카탈로그가 맞춰야 하는 형태 */
export type Catalog = typeof ko;
