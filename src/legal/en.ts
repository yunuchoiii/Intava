import type { LegalPack } from './types';

const EMAIL = 'chltjdnjs529@gmail.com';

export const en: LegalPack = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: October 23, 2026',
    lead: 'intava does not collect personal information.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Nothing. The app has no accounts and never asks for or collects your name, email, phone number, location, contacts, or any other personal information.',
        ],
      },
      {
        heading: 'What the app stores',
        body: ['All of the following is stored only on your device and is never sent to anyone, including the developer:'],
        bullets: [
          'Routines and timers you create (names, exercises, durations, sets and rounds)',
          'Your workout log (when you trained and for how long)',
          'App settings (sound, vibration, notifications, volume, keep-awake, sort order, lock screen timer, Health logging)',
        ],
      },
      {
        heading: 'How long it lives',
        body: [
          'Deleting the app removes this data from your device. The app keeps no copy anywhere else, so deleted data cannot be recovered.',
        ],
      },
      {
        heading: 'Network',
        body: [
          'The app does not connect to the internet. There is no server, no outbound request, and no analytics, advertising, or tracking technology of any kind.',
        ],
      },
      {
        heading: 'Notifications',
        body: [
          "The app uses your device's notification permission to tell you when an interval changes. All notifications are scheduled locally on the device and never pass through a remote push server. The app works normally if you decline the permission.",
        ],
      },
      {
        heading: 'Apple Health (HealthKit)',
        body: [
          'Only if you turn on “Log workouts to Health” in Settings, the app records each workout in Apple Health when it ends. What it writes is the workout type you chose for the routine, the start and end time, and the workout duration; active energy (calories) estimated by iOS during the workout may be attached. These workouts also appear in the Fitness app.',
          'Intava never reads data from Health. Workouts written to Health stay in Apple Health, are not sent to anyone (including the developer), and are not used for advertising or analytics. You can revoke access anytime in iOS Settings → Health → Data Access & Devices.',
          'When the lock screen timer is on, the app runs an iOS workout session during a workout so the timer keeps going while the screen is off. If “Log workouts to Health” is off, that session is discarded and nothing is saved to Health.',
        ],
      },
      {
        heading: 'Lock Screen & Dynamic Island',
        body: [
          'During a workout, the remaining time and current interval are shown on the Lock Screen and in the Dynamic Island. This is created and updated entirely on the device and never passes through a remote push server.',
        ],
      },
      {
        heading: 'Share image',
        body: [
          '“Share” on the finish screen turns the day\'s workout card into an image and hands it to the system share sheet. If you choose “Save Image,” iOS asks for permission to add it to Photos. The app never reads your photo library and keeps no copy of the image.',
        ],
      },
      {
        heading: 'Exported files',
        body: [
          "“Export” in Settings creates a file containing your routines, workout log, and settings, and hands it to your device's share sheet. Where that file goes is entirely your choice. The app takes no part in it and keeps no copy.",
        ],
      },
      {
        heading: 'Third parties',
        body: ['Because nothing is collected, there is nothing to share with or sell to third parties.'],
      },
      {
        heading: 'Children',
        body: ['The app collects no personal information, and therefore collects none from children.'],
      },
      {
        heading: 'Changes',
        body: ['If this policy changes, this document is updated along with the date above.'],
      },
    ],
    contact: { label: 'Questions are welcome at:', email: EMAIL },
  },

  support: {
    title: 'Support',
    lead: 'Common questions.',
    sections: [
      {
        heading: 'Does the timer stop when the screen turns off?',
        body: [
          'No. Using it with the screen off is the normal case. Every interval change is announced with sound and vibration, and also appears as a lock-screen notification.',
        ],
      },
      {
        heading: "I'm not getting notifications.",
        body: [
          'Check Settings → intava → Notifications on your device. Inside the app, sound, vibration, and push notifications can each be turned off separately — worth checking there too.',
        ],
      },
      {
        heading: 'Can I listen to music while using it?',
        body: ['Yes. Cue sounds play over your music without pausing or ducking it.'],
      },
      {
        heading: 'Can I reorder exercises mid-workout?',
        body: [
          "“Edit exercises & order” below the timer changes the remaining order. Exercises you've already finished and the one you're doing now stay put.",
        ],
      },
      {
        heading: 'Will my routines and log move to a new device?',
        body: [
          'Not automatically. Use Settings → Data → Export to save a file, then Import it on the new device.',
        ],
      },
      {
        heading: 'Can I edit a record?',
        body: [
          "Records can't be edited, only deleted. Long-press a session card on the log screen to remove it.",
        ],
      },
    ],
    contact: {
      label: 'Found a bug or want something? Including your device and app version helps.',
      email: EMAIL,
    },
  },
};
