// Run with: node check.ts
import assert from 'node:assert/strict';
import { chapters, events, makeBrief, pathStates, styleForRounds } from './content.ts';

const skills = chapters[0].skills;
const ids = skills.map((s) => s.id);

assert.deepEqual(pathStates(skills, {}), ['current', ...ids.slice(1).map(() => 'locked')], 'fresh path opens only the first skill');
assert.deepEqual(pathStates(skills, { [ids[0]]: 3 }).slice(0, 3), ['mastered', 'current', 'locked'], 'mastering one skill opens the next');
assert.equal(pathStates(skills, { [ids[0]]: 2 })[1], 'locked', 'two rounds do not master a skill');
assert.equal(pathStates(skills, Object.fromEntries(ids.slice(0, -1).map((id) => [id, 3]))).at(-1), 'current', 'mixed practice opens when the chapter is done');
assert.equal(pathStates(skills, { [ids[2]]: 9 })[1], 'locked', 'a later mastered skill does not unlock earlier gaps');

assert.deepEqual([0, 2, 3, 5, 6, 40].map(styleForRounds), ['easy', 'easy', 'reserved', 'reserved', 'hard', 'hard'], 'difficulty rises every three rounds and then stays');

const allRefs = [...ids, ...events.flatMap((e) => e.moments.map((m) => m.id))];
assert.equal(new Set(allRefs).size, allRefs.length, 'progress keys are unique');
for (const e of events) for (const m of e.moments) assert.ok(!m.skillId || ids.includes(m.skillId), `${m.id} links to a real skill`);

const first = () => 0;
const skillBrief = makeBrief({ kind: 'skill', skill: skills[4] }, 0, first);
assert.equal(skillBrief.ref, 'intro');
assert.match(skillBrief.systemPrompt, /ask them what they do/, 'the skill nudge reaches the prompt');
assert.match(skillBrief.systemPrompt, /warm and talkative/, 'a new skill starts with an easy partner');
const momentBrief = makeBrief({ kind: 'moment', event: events[0], moment: events[0].moments[3], style: 'hard' }, 0, first);
assert.match(momentBrief.systemPrompt, /guarded/, 'the chosen partner style reaches the prompt');
assert.match(momentBrief.systemPrompt, /first date/, 'the event sets the partner role');
assert.equal(momentBrief.title, 'A date · When it goes quiet');

console.log('content checks passed');
