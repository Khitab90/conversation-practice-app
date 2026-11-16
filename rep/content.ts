// All practice content and the pure logic that turns it into a conversation brief.
// No React Native imports here, so check.ts can run it under plain Node.

export type Skill = { id: string; name: string; explain: string; example: [them: string, you: string]; goal: string; nudge?: string };
export type Chapter = { name: string; skills: Skill[] };
export type Moment = { id: string; name: string; tip: string; goal: string; scene: string; skillId?: string; nudge?: string };
export type EventDef = { id: string; name: string; blurb: string; icon: string; partner: string; moments: Moment[] };
export type PartnerStyle = 'easy' | 'reserved' | 'hard';

export type Source =
  | { kind: 'skill'; skill: Skill }
  | { kind: 'moment'; event: EventDef; moment: Moment; style: PartnerStyle };

// Everything one conversation needs. `ref` is the key progress is stored under.
export type Brief = { source: Source; ref: string; title: string; scene: string; goal: string; partnerName: string; systemPrompt: string };

export const MASTERY_ROUNDS = 3;

export const chapters: Chapter[] = [
  {
    name: 'Keeping it going',
    skills: [
      {
        id: 'opening', name: 'Greeting and opening',
        explain: 'Start with something you can both see or are both waiting for, then ask one easy question. The topic is the room, not them, so it is low risk.',
        example: ['(You are both waiting for coffee.)', 'This line never moves. Have you tried the cold brew here?'],
        goal: 'Open the conversation and ask one easy question.',
      },
      {
        id: 'open-questions', name: 'Open-ended questions',
        explain: 'Ask questions that cannot be answered with yes or no. "What" and "how" invite a story; "do you" invites one word.',
        example: ['I work at the hospital down the road.', "What's a normal day like for you there?"],
        goal: 'Ask two questions that need more than a yes or no.',
      },
      {
        id: 'follow-ups', name: 'Follow-up questions',
        explain: 'Ask about what they just said instead of changing the subject. It shows you were listening, and people like being asked.',
        example: ["We're in the middle of moving flats.", 'Oh, how is the move going?'],
        goal: 'Ask two follow-up questions about what they just said.',
      },
      {
        id: 'details', name: 'Picking up details',
        explain: 'People mention small extra details in passing. Catch one and ask about it. It shows you heard more than the headline.',
        example: ['…after I got back from Lisbon, I started the new job.', 'Wait, Lisbon. Work or fun?'],
        goal: 'Catch one detail they mention in passing and ask about it.',
      },
      {
        id: 'intro', name: 'Introducing yourself',
        explain: 'When asked what you do, give two or three sentences that end on something they could ask about, then hand the turn back.',
        example: ['So what do you do?', 'I make sure checkout pages work for people using screen readers. It turned into a bit of an obsession. How about you?'],
        goal: 'When asked what you do, answer in two or three sentences and hand the turn back.',
        nudge: 'Within your first two or three turns, ask them what they do.',
      },
      {
        id: 'mixed-1', name: 'Mixed practice',
        explain: 'No single skill this time. Open, ask, follow up, catch details and share a little about yourself. This one never runs out.',
        example: ['Busy in here today.', 'It is. Is it always like this on a Saturday?'],
        goal: 'Keep the conversation going for a few minutes using everything so far.',
      },
    ],
  },
];

export const events: EventDef[] = [
  {
    id: 'date', name: 'A date', blurb: 'First dates and after', icon: 'heart',
    partner: 'on a first date with the user at a quiet bar',
    moments: [
      { id: 'date-first-five', name: 'The first five minutes', skillId: 'opening', scene: 'You have both just sat down. It is the first minute of a first date.', tip: 'Start with the place or the journey here, not an interview question.', goal: 'Get the conversation started warmly and ask one easy question.' },
      { id: 'date-flowing', name: 'Keeping it flowing', skillId: 'follow-ups', scene: 'Drinks have arrived and you are a few minutes in.', tip: 'Ask one more follow-up than feels natural.', goal: 'Ask two follow-up questions about what they just said.' },
      { id: 'date-deeper', name: 'Going a little deeper', scene: 'The small talk has gone well and there is room for something more personal.', tip: 'Share something of your own first, then ask.', goal: 'Share one honest thing about yourself, then ask a question at the same depth.' },
      { id: 'date-quiet', name: 'When it goes quiet', skillId: 'details', scene: 'You are mid-date and the conversation is about to stall.', tip: 'Go back to something they mentioned earlier.', goal: 'Restart the conversation after a silence.', nudge: 'After two or three turns, give one short answer and then say nothing more until they restart the conversation.' },
      { id: 'date-ending', name: 'Ending well', scene: 'The evening is wrapping up and you are about to leave.', tip: 'Say one thing you enjoyed and suggest a next time.', goal: 'End warmly: name something you enjoyed and suggest meeting again.' },
    ],
  },
  {
    id: 'networking', name: 'Networking', blurb: 'Mixers and conferences', icon: 'briefcase',
    partner: 'a guest at a professional mixer who does not know the user',
    moments: [
      { id: 'net-approach', name: 'Approaching someone alone', skillId: 'opening', scene: 'They are standing alone near the drinks table.', tip: 'Comment on the event, then ask what brought them.', goal: 'Open the conversation and ask one easy question.' },
      { id: 'net-intro', name: 'Introducing yourself', skillId: 'intro', scene: 'You have just said hello and they are about to ask what you do.', tip: 'End your answer on something they can ask about.', goal: 'When asked what you do, answer in two or three sentences and hand the turn back.', nudge: 'In your first turn, ask them what they do.' },
      { id: 'net-common', name: 'Finding common ground', skillId: 'follow-ups', scene: 'You are a minute into the conversation.', tip: 'Follow up on their work until you find something you share.', goal: 'Ask two follow-up questions and find one thing you have in common.' },
      { id: 'net-leave', name: 'Leaving gracefully', scene: 'The conversation has run its course and you want to move on.', tip: 'Name something you enjoyed, then say where you are going.', goal: 'End the conversation politely and suggest staying in touch.' },
    ],
  },
];

const everydayScenes = [
  'a slow queue at a coffee shop',
  'a dog park on a weekend morning',
  'the shared laundry room of an apartment building',
  'a small bookshop, both browsing the same shelf',
  'a delayed train platform',
  'a community cooking class, waiting for it to start',
];

const people = [
  { name: 'Dana', about: 'a nurse who has just finished a week of night shifts and has a dog called Max' },
  { name: 'Omar', about: 'a secondary school music teacher who plays bass in a wedding band' },
  { name: 'Priya', about: 'a landscape architect who recently moved here from another city' },
  { name: 'Tom', about: 'a baker who gets up at four and is training for his first half marathon' },
  { name: 'Mei', about: 'a graduate student in marine biology who volunteers at an animal shelter' },
  { name: 'Lucas', about: 'a paramedic who restores old bicycles at the weekend' },
  { name: 'Aisha', about: 'an accountant who has just taken up pottery and is not very good at it yet' },
  { name: 'Ben', about: 'a carpenter and new father who has not slept properly in months' },
];

const styles: Record<PartnerStyle, string> = {
  easy: 'You are warm and talkative, and you ask a question back now and then.',
  reserved: 'You are friendly but brief. You answer in one short sentence and rarely ask a question back.',
  hard: 'You are a little guarded and hard to read. Your answers are short and you leave pauses for them to fill.',
};

// Path difficulty rises with practice: every MASTERY_ROUNDS goal-met rounds moves one style harder.
export function styleForRounds(met: number): PartnerStyle {
  return (['easy', 'reserved', 'hard'] as const)[Math.min(2, Math.floor(met / MASTERY_ROUNDS))];
}

export type NodeState = 'mastered' | 'current' | 'locked';

// A skill unlocks when every skill before it is mastered. The last node in a chapter
// (mixed practice) follows the same rule, so it opens once the chapter is done.
export function pathStates(skills: Skill[], met: Record<string, number>): NodeState[] {
  let open = true;
  return skills.map((s) => {
    const mastered = (met[s.id] ?? 0) >= MASTERY_ROUNDS;
    const state: NodeState = mastered ? 'mastered' : open ? 'current' : 'locked';
    if (!mastered) open = false;
    return state;
  });
}

const pick = <T,>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length)];

export function makeBrief(source: Source, met: number, rand: () => number = Math.random): Brief {
  const person = pick(people, rand);
  const isSkill = source.kind === 'skill';
  const item = isSkill ? source.skill : source.moment;
  const style = isSkill ? styleForRounds(met) : source.style;
  const scene = isSkill ? `You are in ${pick(everydayScenes, rand)}.` : source.moment.scene;
  const role = isSkill ? 'A stranger (the user) starts talking to you.' : `You are ${source.event.partner}.`;
  const systemPrompt = [
    `You are ${person.name}, ${person.about}.`,
    `Setting: ${scene} ${role}`,
    'Stay in character as a real person. Never act as an assistant or a coach, and never mention that this is practice.',
    'Wait for them to speak first. Speak naturally, one or two short sentences per turn.',
    styles[style],
    'Now and then mention a small detail about your life, so they have something to ask about.',
    item.nudge ?? '',
  ].filter(Boolean).join('\n');
  return {
    source, ref: item.id, goal: item.goal, scene, partnerName: person.name, systemPrompt,
    title: isSkill ? source.skill.name : `${source.event.name} · ${source.moment.name}`,
  };
}
