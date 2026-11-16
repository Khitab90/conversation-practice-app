import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Brief, chapters, EventDef, events, makeBrief, MASTERY_ROUNDS, Moment, PartnerStyle, pathStates, Skill } from './content';
import { loadProgress, saveRound } from './db';
import { Feedback, getFeedback, getHint, hasKey, Hint, Line, useConversation } from './gemini';

const c = { bg: '#2C2C2A', card: '#444441', text: '#F1EFE8', dim: '#B4B2A9', faint: '#888780', accent: '#AFA9EC', onAccent: '#26215C', ring: '#3C3489' };
const MAX_SECONDS = 5 * 60;

// shortcut: a state-based router, because Expo Router needs native modules and another full build.
// Move to Expo Router when the app gains tabs or deep links.
type Screen =
  | { name: 'home' }
  | { name: 'event'; event: EventDef }
  | { name: 'brief'; brief: Brief }
  | { name: 'talk'; brief: Brief }
  | { name: 'feedback'; brief: Brief; lines: Line[] };

type IconName = keyof typeof Ionicons.glyphMap;
const t = {
  h: { color: c.text, fontSize: 24, fontWeight: '500' as const },
  body: { color: c.text, fontSize: 16, lineHeight: 23 },
  dim: { color: c.dim, fontSize: 14, lineHeight: 20 },
};

function Button({ label, onPress, quiet, disabled }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={{ backgroundColor: quiet ? c.card : c.accent, borderRadius: 10, padding: 14, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: quiet ? c.text : c.onAccent, fontSize: 17, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, icon, active, onPress }: { label: string; icon: IconName; active?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={{ alignItems: 'center', gap: 4, width: 88 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.accent : c.card }}>
        <Ionicons name={icon} size={22} color={active ? c.onAccent : c.dim} />
      </View>
      <Text style={{ color: c.dim, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const Card = ({ children, outlined }: { children: ReactNode; outlined?: boolean }) => (
  <View style={{ backgroundColor: c.card, borderRadius: 10, padding: 12, gap: 4, borderWidth: 1, borderColor: outlined ? c.accent : c.card }}>{children}</View>
);

// Scrolling content above, main actions pinned at the bottom within thumb reach.
function Page({ children, actions, back }: { children: ReactNode; actions: ReactNode; back?: () => void }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 64, gap: 12 }} keyboardShouldPersistTaps="handled">
        {back && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="arrow-back" size={24} color={c.dim} />
          </Pressable>
        )}
        {children}
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: 40, gap: 12 }}>{actions}</View>
    </KeyboardAvoidingView>
  );
}

function Home({ go }: { go: (s: Screen) => void }) {
  const [tab, setTab] = useState<'path' | 'events'>('path');
  const [progress] = useState(loadProgress);
  const [picked, setPicked] = useState<string | null>(null);

  const chapter = chapters[0];
  const states = pathStates(chapter.skills, progress.met);
  const current = chapter.skills[Math.max(0, states.indexOf('current'))];
  const skill = chapter.skills.find((s) => s.id === picked) ?? current;
  const met = progress.met[skill.id] ?? 0;
  const startSkill = (s: Skill) => go({ name: 'brief', brief: makeBrief({ kind: 'skill', skill: s }, progress.met[s.id] ?? 0) });

  const tabs = (
    <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 10, padding: 3 }} accessibilityRole="tablist">
      {(['path', 'events'] as const).map((k) => (
        <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
          style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: tab === k ? c.accent : 'transparent' }}>
          <Text style={{ color: tab === k ? c.onAccent : c.dim, fontSize: 15, fontWeight: '500' }}>{k === 'path' ? 'Path' : 'Events'}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (tab === 'events') {
    return (
      <Page actions={null}>
        {tabs}
        <Text style={t.h} accessibilityRole="header">What&apos;s coming up?</Text>
        {events.map((e) => (
          <Pressable key={e.id} accessibilityRole="button" onPress={() => go({ name: 'event', event: e })}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name={e.icon as IconName} size={22} color={c.accent} />
                <View><Text style={t.body}>{e.name}</Text><Text style={t.dim}>{e.blurb}</Text></View>
              </View>
            </Card>
          </Pressable>
        ))}
        <Text style={t.dim}>More events are coming later.</Text>
      </Page>
    );
  }

  return (
    <Page actions={<>
      <Card>
        <Text style={t.dim}>{met >= MASTERY_ROUNDS ? `Mastered · ${met} rounds, getting harder` : `Round ${met + 1} of ${MASTERY_ROUNDS} to master`}</Text>
        <Text style={t.body}>{skill.name}</Text>
      </Card>
      <Button label={skill.id === current.id ? 'Continue' : 'Practise again'} disabled={!hasKey} onPress={() => startSkill(skill)} />
    </>}>
      {tabs}
      {!hasKey && <Text style={t.dim}>No Gemini key found. Add EXPO_PUBLIC_GEMINI_KEY to rep/.env and restart.</Text>}
      <Text style={t.dim}>Chapter 1 · {chapter.name}</Text>
      {chapter.skills.map((s, i) => {
        const state = states[i], on = s.id === skill.id;
        return (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.name}, ${state}`} accessibilityState={{ disabled: state === 'locked', selected: on }}
            disabled={state === 'locked'} onPress={() => setPicked(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : state === 'mastered' ? c.ring : c.card }}>
              {state === 'mastered' ? <Ionicons name="checkmark" size={18} color={on ? c.onAccent : c.accent} />
                : state === 'locked' ? <Ionicons name="lock-closed" size={14} color={c.faint} />
                : <Text style={{ color: on ? c.onAccent : c.text, fontWeight: '500' }}>{i + 1}</Text>}
            </View>
            <Text style={[t.body, { color: state === 'locked' ? c.faint : c.text }]}>{s.name}</Text>
          </Pressable>
        );
      })}
      <Text style={t.dim}>Chapter 2 · Building rapport is coming later.</Text>
    </Page>
  );
}

function EventDetail({ event, go }: { event: EventDef; go: (s: Screen) => void }) {
  const [progress] = useState(loadProgress);
  const [style, setStyle] = useState<PartnerStyle>('easy');
  const [moment, setMoment] = useState<Moment>(event.moments.find((m) => !progress.total[m.id]) ?? event.moments[0]);
  const styleNames: Record<PartnerStyle, string> = { easy: 'Easy-going', reserved: 'Reserved', hard: 'Hard to read' };

  return (
    <Page back={() => go({ name: 'home' })} actions={
      <Button label="Start rehearsal" disabled={!hasKey} onPress={() => go({ name: 'brief', brief: makeBrief({ kind: 'moment', event, moment, style }, 0) })} />
    }>
      <Text style={t.dim}>{event.name}</Text>
      <Text style={t.h} accessibilityRole="header">Rehearse the moments</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }} accessibilityRole="radiogroup" accessibilityLabel="How the other person behaves">
        {(Object.keys(styleNames) as PartnerStyle[]).map((k) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: style === k }} onPress={() => setStyle(k)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: style === k ? c.accent : c.card }}>
            <Text style={{ color: style === k ? c.onAccent : c.text, fontSize: 14 }}>{styleNames[k]}</Text>
          </Pressable>
        ))}
      </View>
      {event.moments.map((m) => {
        const n = progress.total[m.id] ?? 0;
        return (
          <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: m.id === moment.id }} onPress={() => setMoment(m)}>
            <Card outlined={m.id === moment.id}>
              <Text style={t.body}>{m.name}</Text>
              <Text style={t.dim}>{n ? `Rehearsed ${n === 1 ? 'once' : `${n} times`}` : m.tip}</Text>
            </Card>
          </Pressable>
        );
      })}
    </Page>
  );
}

function BriefScreen({ brief, go }: { brief: Brief; go: (s: Screen) => void }) {
  const src = brief.source;
  const back = () => go(src.kind === 'moment' ? { name: 'event', event: src.event } : { name: 'home' });
  return (
    <Page back={back} actions={<>
      <Text style={[t.dim, { textAlign: 'center' }]}>Your microphone will be on. Practise somewhere private.</Text>
      <Button label="Start talking" onPress={() => go({ name: 'talk', brief })} />
    </>}>
      <Text style={t.dim}>{src.kind === 'skill' ? 'Learn · 1 min' : src.event.name}</Text>
      <Text style={t.h} accessibilityRole="header">{src.kind === 'skill' ? src.skill.name : src.moment.name}</Text>
      {src.kind === 'skill' ? <>
        <Text style={t.body}>{src.skill.explain}</Text>
        <Card>
          <Text style={t.dim}>Example</Text>
          <Text style={t.body}>{src.skill.example[0]}</Text>
          <Text style={[t.body, { color: c.accent }]}>{src.skill.example[1]}</Text>
        </Card>
      </> : <Text style={t.body}>{src.moment.tip}</Text>}
      <Card><Text style={t.dim}>The scene</Text><Text style={t.body}>{brief.scene} You&apos;ll talk to {brief.partnerName}. You speak first.</Text></Card>
      <Card outlined><Text style={t.dim}>Your goal</Text><Text style={t.body}>{brief.goal}</Text></Card>
    </Page>
  );
}

function Talk({ brief, go }: { brief: Brief; go: (s: Screen) => void }) {
  const convo = useConversation(brief.systemPrompt);
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState<Hint | 'loading' | 'failed' | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');

  const end = () => { convo.stop(); go({ name: 'feedback', brief, lines: convo.transcript() }); };

  useEffect(() => {
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // Ends itself at the time limit; `end` reads only refs and props that do not change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (seconds >= MAX_SECONDS) end(); }, [seconds]);

  const askHint = async () => {
    convo.setPaused(true); setHint('loading');
    try { setHint(await getHint(brief.goal, brief.partnerName, convo.transcript())); } catch { setHint('failed'); }
  };
  const closeHint = () => { convo.setPaused(false); setHint(null); };
  const send = () => { if (draft.trim()) convo.sendText(draft.trim()); setDraft(''); };

  const speaking = convo.phase === 'speaking';
  const status = convo.error ?? (
    convo.phase === 'connecting' ? 'Connecting…'
    : convo.phase === 'ended' ? 'Conversation ended'
    : speaking ? 'Speaking… your mic is paused'
    : hint ? 'Paused while you read the suggestion'
    : convo.muted ? 'Your mic is muted'
    : 'Listening');
  const lastSaid = convo.lines.findLast((l) => l.who === 'them')?.text;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Page actions={<>
      {hint && (
        <Card outlined>
          <Text style={t.dim}>You could say</Text>
          {hint === 'loading' ? <Text style={t.body}>Thinking…</Text>
            : hint === 'failed' ? <Text style={t.body}>Couldn&apos;t get a suggestion. Check your connection.</Text>
            : <><Text style={t.body}>“{hint.line}”</Text><Text style={t.dim}>{hint.why}</Text></>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}><Button label="Another" quiet disabled={hint === 'loading'} onPress={askHint} /></View>
            <View style={{ flex: 1 }}><Button label="Close" quiet onPress={closeHint} /></View>
          </View>
        </Card>
      )}
      {typing && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} returnKeyType="send" autoFocus placeholder="Type what you would say" placeholderTextColor={c.faint}
            accessibilityLabel="Type what you would say" style={[t.body, { flex: 1, backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={22} color={c.accent} />
          </Pressable>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <IconButton label={convo.muted ? 'Mic muted' : 'Mic'} icon={convo.muted ? 'mic-off' : 'mic'} active={!convo.muted} onPress={convo.toggleMute} />
        <IconButton label="Stuck?" icon="bulb" active={hint !== null} onPress={hint ? closeHint : askHint} />
        <IconButton label="Type" icon="keypad" active={typing} onPress={() => setTyping(!typing)} />
      </View>
      <Button label="End conversation" quiet onPress={end} />
    </>}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[t.dim, { flex: 1 }]} numberOfLines={1}>{brief.title}</Text>
        <Text style={t.dim} accessibilityLabel={`${clock} elapsed`}>{clock}</Text>
      </View>
      <Card outlined><Text style={t.dim}>Your goal</Text><Text style={t.body}>{brief.goal}</Text></Card>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
        <View style={{ width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: speaking ? c.ring : c.bg, borderWidth: 1, borderColor: c.ring }}>
          <View style={{ width: speaking ? 84 : 68, height: speaking ? 84 : 68, borderRadius: 42, backgroundColor: c.accent, opacity: convo.phase === 'connecting' ? 0.4 : 1 }} />
        </View>
        <Text style={[t.body, { fontWeight: '500' }]}>{brief.partnerName}</Text>
        <Text style={[t.dim, { textAlign: 'center' }]} accessibilityLiveRegion="polite">{status}</Text>
        {lastSaid && <Text style={[t.dim, { textAlign: 'center' }]}>“{lastSaid.trim()}”</Text>}
      </View>
    </Page>
  );
}

function FeedbackScreen({ brief, lines, go }: { brief: Brief; lines: Line[]; go: (s: Screen) => void }) {
  const spoke = lines.some((l) => l.who === 'you');
  const [result, setResult] = useState<Feedback | 'loading' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!spoke) return;
    let live = true;
    setResult('loading');
    getFeedback(brief.goal, brief.partnerName, lines)
      .then((f) => { if (live) { saveRound(brief.ref, f.goalMet); setResult(f); } })
      .catch(() => { if (live) setResult('failed'); });
    return () => { live = false; };
    // Re-runs only when the user taps Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const again = () => go({ name: 'brief', brief: makeBrief(brief.source, loadProgress().met[brief.ref] ?? 0) });
  const done = () => go(brief.source.kind === 'moment' ? { name: 'event', event: brief.source.event } : { name: 'home' });

  return (
    <Page actions={<><Button label="New round" onPress={again} /><Button label="Done for now" quiet onPress={done} /></>}>
      <Text style={t.dim}>{brief.title}</Text>
      {!spoke ? <>
        <Text style={t.h} accessibilityRole="header">Nothing to review yet</Text>
        <Text style={t.body}>The conversation ended before you said anything, so this round isn&apos;t counted. Have another go when you&apos;re ready.</Text>
      </> : result === 'loading' ? <Text style={t.h} accessibilityRole="header">Listening back…</Text>
        : result === 'failed' ? <>
          <Text style={t.h} accessibilityRole="header">Couldn&apos;t get feedback</Text>
          <Text style={t.body}>Check your connection. Your round isn&apos;t saved until feedback arrives.</Text>
          <Button label="Try again" quiet onPress={() => setAttempt(attempt + 1)} />
        </> : <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={result.goalMet ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={c.accent} />
            <Text style={t.h} accessibilityRole="header">{result.goalMet ? 'Goal met' : 'Not quite yet'}</Text>
          </View>
          <Text style={t.dim}>{brief.goal}</Text>
          <Card><Text style={t.dim}>What worked</Text><Text style={t.body}>{result.worked}</Text></Card>
          <Card><Text style={t.dim}>Try next time</Text><Text style={t.body}>{result.tryNext}</Text></Card>
        </>}
    </Page>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  // Keyed by a counter so every navigation mounts a fresh screen and re-reads progress.
  const [visit, setVisit] = useState(0);
  const go = (s: Screen) => { setScreen(s); setVisit((n) => n + 1); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      {screen.name === 'home' ? <Home key={visit} go={go} />
        : screen.name === 'event' ? <EventDetail key={visit} event={screen.event} go={go} />
        : screen.name === 'brief' ? <BriefScreen key={visit} brief={screen.brief} go={go} />
        : screen.name === 'talk' ? <Talk key={visit} brief={screen.brief} go={go} />
        : <FeedbackScreen key={visit} brief={screen.brief} lines={screen.lines} go={go} />}
    </View>
  );
}
