import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import { todaySession } from './content';
import { gap, openRep, Ratings, saveOutcome, savePrediction } from './db';

const QUESTIONS: { key: keyof Ratings; before: string; after: string }[] = [
  { key: 'awk', before: 'How awkward will it be?', after: 'How awkward was it?' },
  { key: 'like', before: 'How much will they like me?', after: 'How much did they seem to like you?' },
  { key: 'rej', before: 'Chance of rejection?', after: 'How rejected did you feel?' },
];

export default function App() {
  const dark = useColorScheme() === 'dark';
  const c = dark
    ? { bg: '#111', card: '#1c1c1e', text: '#f2f2f2', dim: '#9a9a9a', accent: '#7fb5ff', onAccent: '#111' }
    : { bg: '#fafafa', card: '#fff', text: '#1a1a1a', dim: '#6b6b6b', accent: '#1f5fbf', onAccent: '#fff' };

  const session = todaySession();
  const [screen, setScreen] = useState<'today' | 'rate'>('today');
  // shortcut: warm-up/core ticks are in memory and reset on restart, persist when the ladder is built.
  const [done, setDone] = useState({ warmup: false, core: false });
  const [ratings, setRatings] = useState<Partial<Ratings>>({});
  const [surprise, setSurprise] = useState('');
  const [, refresh] = useState(0);

  const open = openRep();
  const g = gap();
  const complete = QUESTIONS.every((q) => ratings[q.key]);

  const h1 = { color: c.text, fontSize: 28, fontWeight: '700' as const };
  const body = { color: c.text, fontSize: 17, lineHeight: 24 };
  const dim = { color: c.dim, fontSize: 14 };
  const card = { backgroundColor: c.card, borderRadius: 16, padding: 18, gap: 10 };

  const Button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ backgroundColor: c.accent, opacity: disabled ? 0.4 : 1, borderRadius: 12, padding: 14, alignItems: 'center' }}>
      <Text style={{ color: c.onAccent, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  function save() {
    const r = ratings as Ratings;
    if (open) saveOutcome(open.id, r, surprise.trim());
    else savePrediction(session.mission, r);
    setRatings({});
    setSurprise('');
    setScreen('today');
    refresh((n) => n + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 72, gap: 16 }} keyboardShouldPersistTaps="handled">
        {screen === 'today' ? (
          <>
            <Text style={dim}>Week 1 · Calibrate and warm up</Text>
            <Text style={h1} accessibilityRole="header">{session.title}</Text>

            {(['warmup', 'core'] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done[k] }}
                onPress={() => setDone({ ...done, [k]: !done[k] })}
                style={[card, { opacity: done[k] ? 0.5 : 1 }]}>
                <Text style={dim}>{k === 'warmup' ? 'Warm-up · 5 min' : 'Core · 15 min'}{done[k] ? ' · done' : ''}</Text>
                <Text style={body}>{session[k]}</Text>
              </Pressable>
            ))}

            <View style={card}>
              <Text style={dim}>Mission · 10 min</Text>
              <Text style={body}>{open ? open.mission : session.mission}</Text>
              <Button label={open ? 'How did it go?' : 'Predict, then go'} onPress={() => setScreen('rate')} />
            </View>

            {g.n > 0 && (
              <View style={card}>
                <Text style={dim}>Your gap so far · {g.n} {g.n === 1 ? 'rep' : 'reps'}</Text>
                <Text style={body}>Awkwardness: predicted {g.p_awk.toFixed(1)}, actual {g.a_awk.toFixed(1)}</Text>
                <Text style={body}>Liking: predicted {g.p_like.toFixed(1)}, actual {g.a_like.toFixed(1)}</Text>
                <Text style={body}>Rejection: predicted {g.p_rej.toFixed(1)}, actual {g.a_rej.toFixed(1)}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={dim}>{open ? open.mission : session.mission}</Text>
            <Text style={h1} accessibilityRole="header">{open ? 'What actually happened?' : 'Your prediction'}</Text>

            {QUESTIONS.map((q) => (
              <View key={q.key} style={card}>
                <Text style={body}>{open ? q.after : q.before}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const on = ratings[q.key] === n;
                    return (
                      <Pressable
                        key={n}
                        accessibilityRole="radio"
                        accessibilityLabel={`${n} out of 10`}
                        accessibilityState={{ selected: on }}
                        onPress={() => setRatings({ ...ratings, [q.key]: n })}
                        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.bg }}>
                        <Text style={{ color: on ? c.onAccent : c.text, fontSize: 16 }}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {open && (
              <TextInput
                value={surprise}
                onChangeText={setSurprise}
                placeholder="One thing that surprised you (optional)"
                placeholderTextColor={c.dim}
                style={[card, body]}
              />
            )}

            <Button label={open ? 'Save' : 'Save and go do it'} disabled={!complete} onPress={save} />
            <Pressable accessibilityRole="button" onPress={() => { setRatings({}); setScreen('today'); }} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={dim}>Cancel</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
