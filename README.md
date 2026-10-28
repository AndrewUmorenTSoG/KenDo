# KenDo

A little more intentional. A to-do and notes app for Kenny that installs on PC and phone, works offline and sends reminders.

## Stack

- **App:** Vite + React + TypeScript, installable as a PWA (`vite-plugin-pwa`, service worker in `src/sw.ts`).
- **Data and sign-in:** Firebase free tier. Firestore's persistent cache gives offline support and sync across devices.
- **Reminders:** Firebase Cloud Messaging, sent by a Netlify scheduled function (`netlify/functions/send-reminders.mts`) that runs every minute.
- **Hosting:** Netlify (`netlify.toml`).

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase keys
npm run dev
```

To work without a Firebase project, run the local emulators (needs Java) and set `VITE_USE_EMULATORS=true` in `.env`:

```bash
npm run emulators
```

## Firebase setup (one time, free)

1. Create a project at https://console.firebase.google.com (no need for Google Analytics).
2. **Build > Authentication > Get started**, then enable **Email/Password** and **Google**.
3. **Build > Firestore Database > Create database** (production mode, any region close to you).
4. Paste the contents of `firestore.rules` into **Firestore > Rules** and publish. Add the index in `firestore.indexes.json` (or run `npx firebase deploy --only firestore`).
5. **Project settings > General > Your apps > Web app (</>)**: register an app and copy the config values into `.env`.
6. **Project settings > Cloud Messaging > Web Push certificates > Generate key pair**: copy it into `VITE_FIREBASE_VAPID_KEY`.
7. **Project settings > Service accounts > Generate new private key**: you'll paste this JSON into Netlify (below). Never commit it.
8. **Authentication > Settings > Authorized domains**: add your Netlify domain once you have it.

## Deploying to Netlify

1. Netlify > **Add new site > Import an existing project** > pick this GitHub repo. Build settings come from `netlify.toml`.
2. **Site configuration > Environment variables**: add every `VITE_FIREBASE_*` value from `.env`, plus `FIREBASE_SERVICE_ACCOUNT` set to the service account JSON on one line.
3. Deploy. The reminder function shows up under **Functions** as a scheduled function.

## Installing the app

- **PC (Chrome or Edge):** open the site and click the install icon in the address bar.
- **Android (Chrome):** menu > **Install app**.
- **iPhone (Safari):** Share > **Add to Home Screen**. Open KenDo from the Home Screen, then turn on notifications in Settings (iOS only allows push for Home Screen apps).

## Project layout

```
src/
  data/         Firestore reads and writes (tasks, notes, projects)
  lib/          types, recurrence rules, quick-add parsing, Firebase, notifications
  components/   shared UI (Layout, TaskItem, TaskEditor, QuickAdd)
  pages/        Today, Tasks, Notes, Focus, Settings, SignIn
  sw.ts         service worker: offline cache, push reminders, snooze buttons
netlify/functions/send-reminders.mts
```

All data lives under `users/{uid}/...` in Firestore, and the rules only let each user touch their own data.

## Status

Done in the skeleton: sign-in, tasks (quick add with `#tag` and `!high`, edit, due dates, reminders, recurring, priorities, estimates, subtasks, dependencies in the data model), search and filters, Today view with progress, notes (colours, bold/italic/checklists, pin, archive, convert note or highlighted text to a task), focus mode with Pomodoro, dark mode, offline support, push reminders with snooze.

Next: projects and life areas UI, calendar and time blocking, streaks and badges, weekly review, Kanban and Eisenhower views, sharing. AI features are paused until we pick a free model.
