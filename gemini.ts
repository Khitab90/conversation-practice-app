// Everything that talks to Gemini: the live spoken conversation and the short text calls.
import { useEffect, useRef, useState } from 'react';
import { AudioBufferQueueSourceNode, AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

const KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const LIVE_MODEL = 'gemini-3.8-live';
const TEXT_MODEL = 'gemini-3.5-flash-lite';
const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=';
const TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`;

// shortcut: echo cancellation is off because voice processing crashed audio start-up in the
// simulator and is untested on a phone; the hold-back below prevents echo on its own.
// Set EXPO_PUBLIC_ECHO_CANCEL=1 to try it on a real device.
const ECHO_CANCEL = process.env.EXPO_PUBLIC_ECHO_CANCEL === '1';
// The speaker's sound lingers in the room and the output pipeline briefly after the last chunk.
const ECHO_TAIL_MS = 300;

export const hasKey = KEY.length > 0;
export type Line = { who: 'you' | 'them'; text: string };
export type Phase = 'connecting' | 'listening' | 'speaking' | 'ended';

function b64FromFloat32(f: Float32Array): string {
  const bytes = new Uint8Array(f.length * 2);
  for (let i = 0; i < f.length; i++) {
    const n = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    bytes[2 * i] = n & 255; bytes[2 * i + 1] = (n >> 8) & 255;
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function float32FromB64(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64), out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    const n = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    out[i] = (n > 32767 ? n - 65536 : n) / 32768;
  }
  return out;
}

// One spoken conversation. Connects on mount and cleans up on unmount.
export function useConversation(systemPrompt: string) {
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const s = useRef({
    ws: null as WebSocket | null,
    rec: null as AudioRecorder | null,
    ctx: null as AudioContext | null,
    queue: null as AudioBufferQueueSourceNode | null,
    lines: [] as Line[],
    speakingUntil: 0,
    speakingTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    muted: false,
    paused: false,
    stopped: false,
  }).current;

  // Transcripts arrive in pieces; extend the last line while the speaker is the same.
  function push(who: Line['who'], text: string) {
    const last = s.lines.at(-1);
    s.lines = last?.who === who ? [...s.lines.slice(0, -1), { who, text: last.text + text }] : [...s.lines, { who, text }];
    setLines(s.lines);
  }

  function stop() {
    if (s.stopped) return;
    s.stopped = true;
    clearTimeout(s.speakingTimer);
    const ws = s.ws; s.ws = null;
    if (ws && ws.readyState < 2) ws.close();
    s.rec?.clearOnAudioReady(); s.rec?.stop(); s.rec = null;
    s.queue?.stop(); s.queue = null;
    s.ctx?.close(); s.ctx = null;
    AudioManager.setAudioSessionActivity(false);
    setPhase('ended');
  }

  async function startMic() {
    s.rec = new AudioRecorder({ iosVoiceProcessing: ECHO_CANCEL, androidInputPreset: ECHO_CANCEL ? 'voiceCommunication' : 'voiceRecognition' });
    s.rec.onError((e) => setError('Microphone error: ' + e.message));
    s.rec.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, ({ buffer }) => {
      if (s.ws?.readyState !== 1 || s.muted || s.paused) return;
      // While the reply is playing the mic hears the speaker; sending that makes Gemini interrupt itself.
      if (Date.now() < s.speakingUntil + ECHO_TAIL_MS) return;
      s.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64FromFloat32(buffer.getChannelData(0)), mimeType: 'audio/pcm;rate=16000' } } }));
    });
    const r = await s.rec.start();
    if (r.status === 'error') setError('Microphone error: ' + r.message);
  }

  async function start() {
    if ((await AudioManager.requestRecordingPermissions()) !== 'Granted') {
      setError('Microphone access is off. Allow it in Settings to practise by speaking.'); stop(); return;
    }
    AudioManager.setSystemOptions({ ios: { category: 'playAndRecord', mode: ECHO_CANCEL ? 'voiceChat' : 'default', options: ['defaultToSpeaker', 'allowBluetoothHFP'] } });
    await AudioManager.setAudioSessionActivity(true);
    if (s.stopped) return;

    s.ctx = new AudioContext({ sampleRate: 24000 });
    s.queue = s.ctx.createBufferQueueSource();
    s.queue.connect(s.ctx.destination);
    s.queue.start();

    const ws = new WebSocket(LIVE_URL + encodeURIComponent(KEY));
    ws.binaryType = 'arraybuffer';
    s.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: 'models/' + LIVE_MODEL,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: systemPrompt }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    } }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data));
      if (msg.setupComplete) { setPhase('listening'); startMic(); }
      const sc = msg.serverContent; if (!sc) return;
      if (sc.interrupted) { s.queue?.clearBuffers(); s.speakingUntil = 0; clearTimeout(s.speakingTimer); setPhase('listening'); }
      if (sc.inputTranscription?.text) push('you', sc.inputTranscription.text);
      if (sc.outputTranscription?.text) push('them', sc.outputTranscription.text);
      for (const part of sc.modelTurn?.parts ?? []) {
        if (!part.inlineData || !s.ctx || !s.queue) continue;
        const f = float32FromB64(part.inlineData.data);
        const buf = s.ctx.createBuffer(1, f.length, 24000);
        buf.copyToChannel(f, 0);
        s.queue.enqueueBuffer(buf);
        // Chunks arrive faster than they play, so the reply ends this far in the future.
        s.speakingUntil = Math.max(Date.now(), s.speakingUntil) + (f.length / 24000) * 1000;
        setPhase('speaking');
        clearTimeout(s.speakingTimer);
        s.speakingTimer = setTimeout(() => setPhase((p) => (p === 'speaking' ? 'listening' : p)), s.speakingUntil + ECHO_TAIL_MS - Date.now());
      }
    };
    ws.onerror = () => setError('Could not reach the practice partner. Check your connection.');
    ws.onclose = (e) => {
      if (!s.stopped && e.code !== 1000) setError(e.reason || 'The conversation was cut off.');
      stop();
    };
  }

  useEffect(() => {
    start().catch((e) => { setError(String(e?.message ?? e)); stop(); });
    return stop;
    // The conversation is bound to the prompt it mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase, error, lines, muted,
    toggleMute: () => { s.muted = !s.muted; setMuted(s.muted); },
    setPaused: (p: boolean) => { s.paused = p; },
    sendText: (text: string) => { s.ws?.send(JSON.stringify({ realtimeInput: { text } })); push('you', text); },
    stop,
    transcript: () => s.lines,
  };
}

// Model output is untrusted: ask for JSON, then check the fields we rely on.
async function generateJson(prompt: string): Promise<Record<string, unknown>> {
  const res = await fetch(TEXT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  if (!res.ok) throw new Error(`Feedback service returned ${res.status}`);
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = typeof text === 'string' ? JSON.parse(text) : null;
  if (!parsed || typeof parsed !== 'object') throw new Error('Feedback service returned an unexpected reply');
  return parsed;
}

const str = (v: unknown, name: string) => { if (typeof v !== 'string' || !v) throw new Error(`Missing ${name}`); return v; };

const script = (lines: Line[], partner: string) => lines.map((l) => `${l.who === 'you' ? 'Learner' : partner}: ${l.text}`).join('\n');

export type Feedback = { goalMet: boolean; worked: string; tryNext: string };

export async function getFeedback(goal: string, partner: string, lines: Line[]): Promise<Feedback> {
  const j = await generateJson(`You are a kind, specific conversation coach. A learner has just practised a spoken conversation.
Goal: ${goal}
Transcript (Learner is the person practising, ${partner} is the practice partner). It comes from speech recognition, so ignore spelling and small errors:
${script(lines, partner)}

Reply with JSON only: {"goalMet": boolean, "worked": string, "tryNext": string}
- goalMet: true only if the transcript shows the goal was met.
- worked: one sentence naming something the learner did well, quoting their own words. If nothing stands out, name what they attempted.
- tryNext: one sentence giving one specific line they could have said, in quotes, tied to something ${partner} said.
Speak to the learner as "you". No lists.`);
  if (typeof j.goalMet !== 'boolean') throw new Error('Missing goalMet');
  return { goalMet: j.goalMet, worked: str(j.worked, 'worked'), tryNext: str(j.tryNext, 'tryNext') };
}

export type Hint = { line: string; why: string };

export async function getHint(goal: string, partner: string, lines: Line[]): Promise<Hint> {
  const j = await generateJson(`A learner is practising a spoken conversation with ${partner} and has gone blank.
Their goal: ${goal}
Conversation so far${lines.length ? '' : ' (nothing has been said yet, so suggest a way to open)'}:
${script(lines, partner)}

Reply with JSON only: {"line": string, "why": string}
- line: one short, natural thing the learner could say next. It responds to the last thing ${partner} said and moves towards the goal. Never repeat a question the learner already asked.
- why: at most ten words on why it works.`);
  return { line: str(j.line, 'line'), why: str(j.why, 'why') };
}
