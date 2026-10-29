# KenDo

A little more intentional. A to-do and notes app for Kenny that installs on PC and phone, works offline and sends reminders.

## Stack

- **App:** Vite + React + TypeScript, installable as a PWA (`vite-plugin-pwa`, service worker in `src/sw.ts`).
- **Data and sign-in:** Firebase free tier. Firestore's persistent cache gives offline support and sync across devices.
- **Reminders:** Firebase Cloud Messaging, sent by a Netlify scheduled function (`netlify/functions/send-reminders.mts`) that runs every 5 minutes, so a reminder arrives within 5 minutes of its time. This keeps the whole app inside the free plans of Firebase and Netlify.
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
3. Deploy. The reminder function shows up under **Functions** as a scheduled function, next to `calendar-feed`.

## Installing the app

- **PC (Chrome or Edge):** open the site and click the install icon in the address bar.
- **Android (Chrome):** menu > **Install app**.
- **iPhone (Safari):** Share > **Add to Home Screen**. Open KenDo from the Home Screen, then turn on notifications in Settings (iOS only allows push for Home Screen apps).

## Project layout

```
src/
  styles.css    the KenDo design system from the Codex UI/UX screens
  app.css       small additions (sign-in, update banner)
  data/         Firestore reads and writes, plus the StoreProvider that keeps them live
  hooks/        auth, dialogs and toasts, focus timer, task completion
  lib/          types, dates, recurrence, quick-add parsing, Firebase, notifications
  components/   app shell, task rows, task and note editors, dialogs
  pages/        My day, All tasks, Calendar, Projects, Notes, Focus, Habits, Review,
                Matrix, Mind map, Workspace, Settings, Sign in
  sw.ts         service worker: offline cache, push reminders, snooze buttons
netlify/functions/  send-reminders (every 5 minutes), calendar-feed (the private .ics link)
```

All data lives under `users/{uid}/...` in Firestore (tasks, notes, projects, habits, focusSessions, devices, joined, plus the profile on `users/{uid}`), and the rules only let each user touch their own data. A shared project keeps its tasks under `users/{owner}/projects/{id}/tasks`, which every member of that project can read and edit; members keep a pointer to it in `users/{uid}/joined`.

## Status

Built on Codex's screens and wired to Firebase:

- **Tasks:** quick add (understands `today`, `tomorrow`, `6pm`, `18:30`, `#tag` and `!high`), full editor, due dates and times, daily/weekly/monthly repeats, priorities, energy, estimates, subtasks, comments, activity history, dependencies, attached notes.
- **Views:** My day with progress, streak and agenda; All tasks grouped by Overdue/Today/Coming up/Someday; search; filters; Plan my day.
- **Projects:** Kanban board with drag and drop, project templates, starter life areas.
- **Notes:** ten colours, bold/italic/bullets/checklists (Enter starts the next box), pin, archive, whole note or highlighted text to a task.
- **Focus room:** focus, break and rest timers (one colour each, lengths set with a slider) that keep running across pages, a full screen mode with falling leaves, focus history, and a fresh encouraging Bible verse (KJV) for each session, gentler ones during breaks.
- **Look and feel:** 11 colour themes, each with light and dark versions, and a light/dark switch in the top bar.
- **Bible verses:** a verse of the day on My day. Can be turned off in Settings.
- **Habits & goals, Weekly review, Priority matrix, Mind map, Calendar** (week view, click to plan, drag to reschedule).
- **Reminders:** push notifications with snooze, even when the app is closed. Dark mode, offline support, JSON export.

- **Sharing:** share any project from its board or the Workspace page. Kenny gets an invite link to send by text or WhatsApp; whoever opens it and signs in joins. Everyone in the project sees the same tasks live, can add and tick them off, and the rest of their tasks stay private. The owner can remove people, make a new link or stop sharing.

- **Google Calendar & Outlook:** Settings > Connected calendars makes a private link that both can subscribe to, so dated tasks (including shared projects) show up in your calendar. It is one way, KenDo to calendar, and Google and Outlook refresh it on their own schedule, usually every few hours. Disconnect turns the link off. Any dated task can also be added on its own from the task editor.

Next: voice input, widgets, AI features once we pick a free model.
