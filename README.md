# Rep: a voice conversation gym for introverts

Rep is a mobile app for practising conversations out loud. You speak, an AI character speaks back, and the conversation carries on as it would with a real person. Each session teaches one conversational skill, has you use it in a short spoken conversation, and then tells you how it went.

"Rep" is a working name. The app is a personal project and an early first version.

## Why

Introverts usually know roughly what good conversation looks like. What is missing is a low-stakes place to rehearse it out loud, because reading advice does not build the reflex and practising on real people feels expensive when a skill is new.

The content is based on a research summary of the conversation literature: studies on talking to strangers, follow-up questions, and how people underestimate how well conversations go.

## Screens

| Home | Path | Events |
|---|---|---|
| <img src="docs/screens/0-home.png" width="220" alt="Home screen: two large buttons in the middle, Path showing the next skill and a progress bar, and Events"> | <img src="docs/screens/1-path.png" width="220" alt="Path screen: a night map with a winding road and a star-rated stop for each skill, the first one current and the rest locked, with a Continue button at the bottom"> | <img src="docs/screens/2-events.png" width="220" alt="Events screen: a back arrow and a list with A date and Networking"> |

| Event moments | Lesson | Conversation |
|---|---|---|
| <img src="docs/screens/3-event.png" width="220" alt="A date: partner style choices and five moments to rehearse, with Start rehearsal at the bottom"> | <img src="docs/screens/4-lesson.png" width="220" alt="Lesson screen: the skill explained, an example, the scene and the goal"> | <img src="docs/screens/5-conversation.png" width="220" alt="Conversation screen: the goal, a circle for the character Dana, her last line, and Mic, Stuck and Type buttons above End conversation"> |

| Feedback |
|---|
| <img src="docs/screens/6-feedback.png" width="220" alt="Feedback screen: goal met, what worked, and a line to try next time"> |

## Features

**Two ways to practise**

The app opens on two buttons, Path and Events. A back arrow in either one returns you there to switch.

- **Path.** A night map with a winding road. Each skill is a stop on the road, and they unlock in order: greeting and opening, open-ended questions, follow-up questions, picking up details, and introducing yourself. Each round in which you meet a skill's goal earns it a star, and three stars master it. After that it stays open, and your practice partner gets harder every three rounds. Each chapter ends in a mixed-practice round that never runs out.
- **Events.** Rehearsal for something coming up. Pick an event (a date or networking, so far), choose how the other person behaves (easy-going, reserved or hard to read), and rehearse one moment at a time, such as the first five minutes or leaving gracefully.

**In a conversation**

- A new character and setting are generated for every round.
- The character replies in a spoken voice, and a caption shows their last line.
- **Mic** mutes your microphone.
- **Stuck?** pauses the conversation and suggests one thing you could say.
- **Type** lets you type a line instead of speaking it.
- Your microphone audio is held back while the character is talking, so the character never reacts to its own voice.

**Afterwards**

- Feedback says whether you met the goal, quotes something you said that worked, and offers one line to try next time.
- Progress is saved on the device. There are no accounts.

## How it works

```mermaid
flowchart TD
    Home[Home] --> Choice{Path or Events?}
    Choice -->|Path| Skill[Next skill on the map]
    Choice -->|Events| Moment[Pick an event, a moment and a partner style]
    Skill --> Lesson[Lesson: the skill, an example and your goal]
    Moment --> Brief[Brief: a tip, the scene and your goal]
    Lesson --> Talk
    Brief --> Talk
    Talk[Spoken conversation with a generated character] --> End[End, or five minutes pass]
    End --> Feedback[Feedback from the transcript]
    Feedback --> Save[(Round saved on the device)]
    Save --> Again{What next?}
    Again -->|New round| Talk
    Again -->|Done| Home
```

**What happens during a conversation**

```mermaid
sequenceDiagram
    participant You
    participant App
    participant Live as Gemini Live
    participant Text as Gemini Flash Lite

    App->>Live: Open a session with the character's instructions
    loop Each turn
        You->>App: Speak
        App->>Live: Microphone audio (16 kHz)
        Live-->>App: Transcript of what you said
        Live-->>App: Spoken reply (24 kHz) and its transcript
        App-->>You: Play the reply, holding back the microphone meanwhile
    end
    opt You tap Stuck?
        App->>Text: Transcript so far and the goal
        Text-->>App: One suggested line
    end
    You->>App: End conversation
    App->>Text: Full transcript and the goal
    Text-->>App: Goal met or not, what worked, what to try
    App-->>You: Feedback
```

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo SDK 54 (React Native 0.81) with TypeScript |
| Spoken conversation | Gemini Live API (`gemini-3.8-live`) over a WebSocket |
| Feedback and "Stuck?" suggestions | Gemini Flash Lite (`gemini-3.5-flash-lite`) over REST |
| Audio capture and playback | `react-native-audio-api` |
| Progress storage | SQLite on the device (`expo-sqlite`) |
| Icons | `@expo/vector-icons` (Ionicons) |

Both Gemini models are used on the free tier. On that tier, conversations may be used by Google to improve its products.

## Repository layout

| Path | What it holds |
|---|---|
| [`rep/`](rep) | The Expo app |
| [`rep/App.tsx`](rep/App.tsx) | Screens and navigation |
| [`rep/content.ts`](rep/content.ts) | Skills, events, characters, and the logic that builds a conversation |
| [`rep/gemini.ts`](rep/gemini.ts) | The live conversation, feedback and suggestions |
| [`rep/db.ts`](rep/db.ts) | Saved progress |
| [`rep/check.ts`](rep/check.ts) | Checks for the content logic |
| [`voice-test/`](voice-test) | A one-page browser test of the Gemini Live API |

## Running it

You need a Mac with Xcode 16.1 or later, Node, CocoaPods, and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/api-keys).

1. Install dependencies:

   ```bash
   cd rep && npm install
   ```

2. Create `rep/.env` with one line, using your own key. This file is ignored by Git.

   ```
   EXPO_PUBLIC_GEMINI_KEY=your-key-here
   ```

3. Build and run in the iOS simulator. The app uses native audio, so it needs a development build and does not run in Expo Go.

   ```bash
   npx expo run:ios
   ```

To run the content checks and the type-check:

```bash
node check.ts
```

```bash
npx tsc --noEmit
```

## Status and limits

This is a first version, tested in the iOS simulator only.

- The key is read by the app directly, which is fine for personal use. A shared build would need a small server in between so the key is not shipped inside the app.
- You cannot interrupt the character mid-reply, because the microphone is held back while it speaks.
- The project stays on Expo SDK 54 so that it builds with Xcode 16. A `postinstall` script patches one line of `react-native-audio-api` for the same reason.
- Android and real iPhones are untested.

Planned next: more chapters and events, feedback on how you sound (pace, volume, clarity) with short voice exercises, onboarding, and settings.

This app is practice, not treatment. If fear of conversation is stopping daily life, a professional can help.
