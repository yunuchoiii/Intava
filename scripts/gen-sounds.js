/**
 * 알림음 생성기 — assets/sounds/*.wav
 *
 *   node scripts/gen-sounds.js
 *
 * 설계 원칙
 * - **순수 사인파.** 배음을 섞으면 귀를 찌른다. 음색은 사인 하나로 끝낸다.
 * - **부드러운 엔벨로프.** 어택 18ms · 릴리스는 길이의 40%. 딸깍임과 날카로움이 사라진다.
 * - **음정을 쓴다.** 아무 주파수나 쓰지 않고 화음(장3화음·완전5도)으로 묶으면
 *   여러 번 들어도 피로하지 않다.
 * - 음악과 겹치는 대역을 피하되(1~2kHz), 3kHz 근처의 자극적인 구간은 쓰지 않는다.
 */
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

// 음이름 → 주파수 (A4 = 440)
const NOTE = {
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  G6: 1567.98,
  A6: 1760,
  C7: 2093,
};

/** 16-bit mono PCM WAV */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** 사인 한 음 — 어택 18ms, 릴리스는 길이의 40%(최대 220ms) */
function tone(freq, ms, gain = 0.55) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  const attack = Math.min(Math.round(RATE * 0.018), Math.floor(n * 0.3));
  const release = Math.min(Math.round(RATE * 0.22), Math.floor(n * 0.4));
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > n - release) env = (n - i) / release;
    env = env * env * (3 - 2 * env); // smoothstep — 모서리를 둥글게
    out[i] = Math.sin((2 * Math.PI * freq * i) / RATE) * env * gain;
  }
  return out;
}

/** 두 음을 겹쳐 화음으로 (따로 치면 급해 보이는 신호를 부드럽게 만든다) */
function chord(freqs, ms, gain = 0.5) {
  const parts = freqs.map((f) => tone(f, ms, gain / Math.sqrt(freqs.length)));
  const out = new Float32Array(parts[0].length);
  for (const p of parts) for (let i = 0; i < out.length; i++) out[i] += p[i];
  return out;
}

function silence(ms) {
  return new Float32Array(Math.round((RATE * ms) / 1000));
}

function seq(...parts) {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const FILES = {
  // 웜업·준비 시작 — 부드러운 안내음 하나
  cue: tone(NOTE.C6, 240, 0.45),

  // 카운트다운 3·2·1 — 짧고 작게. 세 번 연달아 들어도 거슬리지 않아야 한다
  tick: tone(NOTE.A6, 70, 0.3),

  // 운동 시작 — "땡". 카운트다운 끝의 도착음이라 가장 또렷하다 (E6+C7 완전5도)
  work: chord([NOTE.E6, NOTE.C7], 460, 0.6),

  // 세트 휴식 — 한 옥타브 아래로 내려앉는 같은 음색
  rest: chord([NOTE.B5, NOTE.E6], 460, 0.5),

  // 종목 전환 — 2음 하강
  block: seq(tone(NOTE.E6, 200, 0.5), silence(20), tone(NOTE.C6, 300, 0.5)),

  // 라운드 휴식 — 3음 하강
  round: seq(
    tone(NOTE.G6, 190, 0.5),
    silence(15),
    tone(NOTE.E6, 190, 0.5),
    silence(15),
    tone(NOTE.C6, 340, 0.5)
  ),

  // 쿨다운 — 더 낮고 더 느리게
  cooldown: seq(tone(NOTE.D6, 280, 0.4), silence(40), tone(NOTE.A5, 460, 0.4)),

  // 전체 완료 — 도·미·솔 상승 후 화음
  done: seq(
    tone(NOTE.C6, 170, 0.5),
    silence(10),
    tone(NOTE.E6, 170, 0.5),
    silence(10),
    chord([NOTE.G6, NOTE.C6], 620, 0.55)
  ),

  // 백그라운드 오디오 세션 유지용 무음 루프 (계층 1)
  silence: silence(1000),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(FILES)) {
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(3)}s`);
}
