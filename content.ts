// Week 1 of the Playbook. Index 0 = Monday … 4 = Friday, 5 = weekend.
export type Session = { title: string; warmup: string; core: string; mission: string };

export const week1: Session[] = [
  {
    title: 'Baseline',
    warmup: 'Write one sentence: "My prediction for this week is probably too pessimistic because ___."',
    core: 'Safety-behaviour audit: list what you do to stay safe socially (phone checking, rehearsing lines, standing by the exit). Circle three.',
    mission: 'Make eye contact, greet and thank a cashier with your phone in your pocket.',
  },
  {
    title: 'The reappraisal reset',
    warmup: 'Notice your heart rate. Say "I am excited" out loud three times. Don\'t try to calm down.',
    core: 'Record a 60-second answer to "So what do you do?" three ways: default, story, and bridge. Keep the one that ends with a hook.',
    mission: 'Ask a cashier or barista one real question, like "What\'s the most underrated thing on the menu?"',
  },
  {
    title: 'Shadowing for rhythm',
    warmup: 'Say "I am excited" three times, then breathe out slowly for a minute.',
    core: 'Play an interview podcast. Pause after each answer and say your own follow-up question aloud. Do 8–10 rounds.',
    mission: 'Ask a coworker one non-work question, then one follow-up on their answer.',
  },
  {
    title: 'Topic prep',
    warmup: 'Pick one of your three safety behaviours to drop today.',
    core: 'Build a Topic Deck: five topics you can talk about with energy, each with one question to hand back. Say each aloud once.',
    mission: 'Use one Topic Deck item in a real conversation.',
  },
  {
    title: 'First checkpoint',
    warmup: 'Say "I am excited" three times.',
    core: 'Look at your gap below. Write the biggest surprise, the hardest safety behaviour to drop, and one rep you\'d repeat.',
    mission: 'Message one weak tie with a line about something specific: "Saw this and thought of your project — how did it ship?"',
  },
  {
    title: 'Light day',
    warmup: 'Nothing to prepare today.',
    core: 'Schedule a recovery block on purpose: a walk, reading, a solo project. It is part of the plan.',
    mission: 'Optional: greet a neighbour or ask a market vendor one question.',
  },
];

export function todaySession(date = new Date()): Session {
  const day = date.getDay(); // 0 = Sunday
  return week1[day >= 1 && day <= 5 ? day - 1 : 5];
}
