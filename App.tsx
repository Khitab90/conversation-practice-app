// Throwaway test: can an Expo app hold a spoken conversation with Gemini Live?
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AudioBufferQueueSourceNode, AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

const KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const MODEL = 'gemini-3.8-live';
const URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=';
const PROMPT = `You are Dana, a nurse coming off a week of night shifts, standing in a coffee queue.
A stranger starts talking to you. Reply as Dana would: friendly, one or two short sentences,
and mention small details about your life that they could ask about. Never act as an assistant.`;

// The speaker's sound lingers in the room and the output pipeline briefly after the last chunk.
const ECHO_TAIL_MS = 300;

function b64FromFloat32(f: Float32Array): { b64: string; loud: boolean } {
  const bytes = new Uint8Array(f.length * 2);
  let s = '', sum = 0;
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    const n = Math.round(v * 32767);
    bytes[2 * i] = n & 255; bytes[2 * i + 1] = (n >> 8) & 255;
    sum += v * v;
  }
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return { b64: btoa(s), loud: Math.sqrt(sum / f.length) > 0.02 };
}

function float32FromB64(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64), out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    const n = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    out[i] = (n > 32767 ? n - 65536 : n) / 32768;
  }
  return out;
}

export default function App() {
  const [on, setOn] = useState(false);
  // Off for the simulator, where voice processing hangs audio start-up; on for a real phone.
  const [aec, setAec] = useState(true);
  // Off = playback only, to test the reply path where the microphone is unavailable.
  const [mic, setMic] = useState(true);
  const [status, setStatus] = useState(KEY ? 'Not connected.' : 'No key. Add EXPO_PUBLIC_GEMINI_KEY to rep/.env and restart.');
  const [lines, setLines] = useState<string[]>([]);
  const [stats, setStats] = useState({ sent: 0, held: 0, got: 0, interrupts: 0, delays: [] as number[] });

  const ws = useRef<WebSocket | null>(null);
  const rec = useRef<AudioRecorder | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const queue = useRef<AudioBufferQueueSourceNode | null>(null);
  const timing = useRef({ lastVoiceAt: 0, awaiting: false, who: '', speakingUntil: 0 });

  // Transcripts arrive in pieces; extend the last line while the speaker is the same.
  function say(who: string, text: string) {
    const same = timing.current.who === who; // read now; the updater below runs later
    setLines((l) => (same && l.length ? [...l.slice(0, -1), l[l.length - 1] + text] : [...l, `${who}: ${text}`]));
    timing.current.who = who;
  }

  async function start() {
    if (mic && (await AudioManager.requestRecordingPermissions()) !== 'Granted') { setStatus('Microphone permission denied.'); return; }
    // voiceChat + voice processing gives echo cancellation, so the speaker does not feed the mic.
    AudioManager.setSystemOptions({ ios: mic
      ? { category: 'playAndRecord', mode: aec ? 'voiceChat' : 'default', options: ['defaultToSpeaker', 'allowBluetoothHFP'] }
      : { category: 'playback', mode: 'default', options: [] } });
    await AudioManager.setAudioSessionActivity(true);

    ctx.current = new AudioContext({ sampleRate: 24000 });
    queue.current = ctx.current.createBufferQueueSource();
    queue.current.connect(ctx.current.destination);
    queue.current.start();

    setLines([]); setStats({ sent: 0, held: 0, got: 0, interrupts: 0, delays: [] }); timing.current.speakingUntil = 0; timing.current.who = '';
    setStatus('Connecting…'); setOn(true);

    const sock = new WebSocket(URL + encodeURIComponent(KEY));
    sock.binaryType = 'arraybuffer';
    ws.current = sock;
    sock.onopen = () => sock.send(JSON.stringify({ setup: {
      model: 'models/' + MODEL,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: PROMPT }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    } }));
    sock.onmessage = (e) => {
      const msg = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data));
      if (msg.setupComplete) { setStatus(mic ? 'Connected. Say hello.' : 'Connected. Microphone off.'); if (mic) startMic(); }
      const sc = msg.serverContent; if (!sc) return;
      if (sc.interrupted) { queue.current?.clearBuffers(); timing.current.speakingUntil = 0; setStats((s) => ({ ...s, interrupts: s.interrupts + 1 })); }
      if (sc.inputTranscription?.text) say('You', sc.inputTranscription.text);
      if (sc.outputTranscription?.text) say('Dana', sc.outputTranscription.text);
      for (const part of sc.modelTurn?.parts ?? []) {
        if (!part.inlineData || !ctx.current || !queue.current) continue;
        const f = float32FromB64(part.inlineData.data);
        const buf = ctx.current.createBuffer(1, f.length, 24000);
        buf.copyToChannel(f, 0);
        queue.current.enqueueBuffer(buf);
        const t = timing.current;
        // Chunks arrive faster than they play, so the reply ends this far in the future.
        t.speakingUntil = Math.max(Date.now(), t.speakingUntil) + (f.length / 24000) * 1000;
        const delay = t.awaiting ? Date.now() - t.lastVoiceAt : null;
        t.awaiting = false;
        setStats((s) => ({ ...s, got: s.got + 1, delays: delay === null ? s.delays : [...s.delays, delay] }));
      }
    };
    sock.onerror = () => setStatus('Connection error.');
    sock.onclose = (e) => { setStatus(`Closed (${e.code}) ${e.reason ?? ''}`); stop(); };
  }

  async function startMic() {
    rec.current = new AudioRecorder({ iosVoiceProcessing: aec, androidInputPreset: aec ? 'voiceCommunication' : 'voiceRecognition' });
    rec.current.onError((e) => setStatus('Mic error: ' + e.message));
    rec.current.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, ({ buffer }) => {
      if (ws.current?.readyState !== 1) return;
      // While the reply is playing the mic hears the speaker; sending that makes Gemini interrupt itself.
      if (Date.now() < timing.current.speakingUntil + ECHO_TAIL_MS) { setStats((s) => ({ ...s, held: s.held + 1 })); return; }
      const { b64, loud } = b64FromFloat32(buffer.getChannelData(0));
      // Reply delay = time from the last loud mic chunk to the first audio back.
      if (loud) { timing.current.lastVoiceAt = Date.now(); timing.current.awaiting = true; }
      ws.current.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } } }));
      setStats((s) => ({ ...s, sent: s.sent + 1 }));
    });
    const r = await rec.current.start();
    if (r.status === 'error') setStatus('Mic error: ' + r.message);
  }

  function stop() {
    const sock = ws.current; ws.current = null;
    if (sock && sock.readyState < 2) sock.close();
    rec.current?.clearOnAudioReady(); rec.current?.stop(); rec.current = null;
    queue.current?.stop(); queue.current = null;
    ctx.current?.close(); ctx.current = null;
    AudioManager.setAudioSessionActivity(false);
    setOn(false);
  }

  // Lets the reply path be tested without speaking (useful in the simulator).
  function sendText() {
    timing.current.lastVoiceAt = Date.now(); timing.current.awaiting = true;
    ws.current?.send(JSON.stringify({ realtimeInput: { text: 'Hi, long queue today, huh?' } }));
    say('You (typed)', 'Hi, long queue today, huh?');
  }

  const d = stats.delays;
  const avg = d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
  const btn = { backgroundColor: '#AFA9EC', borderRadius: 10, padding: 14, alignItems: 'center' as const };
  const btnText = { color: '#26215C', fontSize: 17, fontWeight: '500' as const };
  const dim = { color: '#B4B2A9', fontSize: 14 };

  const toggle = (label: string, icon: keyof typeof Ionicons.glyphMap, active: boolean, onPress: () => void, role: 'switch' | 'button' = 'switch') => (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'switch' ? { checked: active } : undefined}
      onPress={onPress}
      style={{ alignItems: 'center', gap: 4, width: 88 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? '#AFA9EC' : '#444441' }}>
        <Ionicons name={icon} size={22} color={active ? '#26215C' : '#B4B2A9'} />
      </View>
      <Text style={{ color: '#B4B2A9', fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#2C2C2A' }}>
      <StatusBar style="light" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 72, gap: 12 }}>
        <Text style={{ color: '#F1EFE8', fontSize: 22, fontWeight: '500' }} accessibilityRole="header">Gemini Live voice test</Text>
        <Text style={dim}>{status}</Text>
        <Text style={dim}>
          Mic chunks sent {stats.sent}, held back {stats.held} · audio chunks received {stats.got} · interruptions {stats.interrupts}
          {avg !== null ? ` · reply delay last ${d[d.length - 1]} ms, average ${avg} ms` : ''}
        </Text>
        {lines.map((l, i) => <Text key={i} style={{ color: '#F1EFE8', fontSize: 16, lineHeight: 23 }}>{l}</Text>)}
      </ScrollView>
      {/* Controls sit at the bottom, within thumb reach; the main button is lowest. */}
      <View style={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {on
            ? toggle('Typed hello', 'chatbubble-ellipses', false, sendText, 'button')
            : <>
                {toggle('Mic', mic ? 'mic' : 'mic-off', mic, () => setMic(!mic))}
                {toggle('Echo cancel', 'pulse', aec, () => setAec(!aec))}
              </>}
        </View>
        <Pressable accessibilityRole="button" disabled={!KEY} onPress={() => (on ? stop() : start().catch((e) => { setStatus(String(e?.message ?? e)); stop(); }))} style={[btn, { opacity: KEY ? 1 : 0.4 }]}>
          <Text style={btnText}>{on ? 'End conversation' : 'Start conversation'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
