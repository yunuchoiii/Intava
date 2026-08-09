# Intava — Store Listing (English)

Same feature set as [ko.md](ko.md) — this is an independent keyword pass for English-speaking
search behavior, not a translation. English fitness-app search terms cluster differently
(e.g. "EMOM", "AMRAP", "circuit training" are common in English but have no equivalent
search volume pattern in Korean).

No ad SDK, no IAP, no analytics SDK in the codebase — "no ads" is a true claim.

## What the app actually does

- **Routines**: chain multiple exercises into an order + rounds, guided step by step during the workout
- **Timers**: a simple repeating interval — just work / rest / sets
- **Warmup, prepare, cooldown**
- **Background push**: interval changes announced by sound, vibration, and push notification even if the app is fully killed; notification sound layers over music without lowering its volume
- **Workout history**: monthly calendar, total time, pure work time, completed sets/rounds, finished/stopped tag
- **Local-only**: no login, nothing sent to a server, export/import for backup and device transfer
- **Dark UI**, multilingual (ko/en/ja/zh-Hans)

Do not claim features that don't exist — no "AI coach", no cloud sync.

---

## App Store (iOS)

### Name (30 char limit)
```
Intava: Interval Timer
```

### Subtitle (30 char limit)
```
HIIT, Tabata & Circuit Timer
```

### Keywords field (100 char limit, comma-separated, no spaces — don't repeat words already in name/subtitle)
```
workout,routine,rest,set,round,gym,emom,amrap,boxing,cardio,strength,offline,exercise,fitness
```

### Promotional text (170 char limit — editable anytime without review)
```
No need to watch the screen — sound and vibration guide every interval. Build routines or simple timers, track your workouts. No ads, no login required.
```

### Description (4000 char limit — first 3 lines matter most, shown before "more")
```
A workout timer you don't have to watch, Intava.

Sound and vibration announce every interval, so you can set your phone down and focus on the workout. Notifications keep going even if the app is fully closed.

■ Routines — chain exercises in order
Squats, planks, burpees — arrange them in the order and number of rounds you want, and Intava tells you what's next without you looking at the screen.

■ Timers — just set work, rest, and sets
A simple interval timer for Tabata, HIIT, and circuit training — anything built on repeating one move.

■ Warmup · prepare · cooldown
The time before and after your main workout is part of the same flow, not a separate step.

■ Notifications that survive the background
Even with the app fully closed, every interval change comes through as a push notification with sound and vibration. Listening to music? The cue layers on top without turning your volume down.

■ Workout history
See which days you worked out on a monthly calendar, along with total time, pure work time, and completed sets.

■ No ads, no account
Nothing to sign up for. Everything stays on your device — no ads either. Switching phones? Export and import move everything in one file.

Built for you if
- You don't want to keep staring at your phone at the gym or during home workouts
- You want to build Tabata, HIIT, or circuit routines with your own sets and rounds
- You want to track your workouts without a complicated app

Focus on the workout, not the screen — that's Intava.
```

---

## Google Play (Android)

No dedicated keyword field — title, short description, and full description directly affect
ranking. Slightly denser natural repetition than the App Store copy.

### Title (30 char limit)
```
Intava - Interval Timer
```

### Short description (80 char limit)
```
Interval, Tabata & circuit timer — screen-free with sound & vibration cues.
```

### Full description (4000 char limit)
```
Intava is an interval workout timer you don't need to keep watching.

Sound and vibration tell you when the interval changes, so you don't have to stare at your phone during Tabata, HIIT, or circuit training. Notifications keep working in the background even if the app is fully closed.

■ Routines — exercises in order and rounds
Arrange squats, planks, lunges, burpees, and more into an order and number of rounds, and Intava guides you through them automatically. Great for circuit training and full-body routines.

■ Timers — just work, rest, and sets
A simple interval timer for Tabata timer or HIIT timer workouts — repeat one move for a set time and number of sets.

■ Warmup · prepare · cooldown
The time before and after your main workout flows into the same session.

■ Background notifications
Even with the app fully closed, every work/rest interval change comes through as a push notification with sound and vibration. Notification sounds layer on top of your music without lowering the volume.

■ Workout history
A monthly calendar shows which days you worked out, with total time, pure work time, and completed sets and rounds.

■ No ads, no account
No sign-up, no login. Every routine, timer, and workout log stays on your device — nothing is sent to a server. Switching devices or need a backup? Export and import move everything in one file. No ads either.

Built for you if
- You don't want to keep looking at your phone at the gym or during home workouts
- You want to build your own Tabata, HIIT, or circuit training with custom sets and rounds
- You want to track bodyweight workout routines and keep a workout history
- You want a lightweight interval timer with no ads and no login

Interval timer, Tabata timer, circuit timer, HIIT timer — Intava covers it all.
```

## Next steps

1. When screenshots arrive, write per-screen marketing captions in English too.
2. After launch, check App Store Connect search-term impressions and Play Console listing experiments to refine these — this draft has no live search-volume data behind it.

Related: `ko.md`, session memory `intava-aso-launch`
