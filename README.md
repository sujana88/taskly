# Taskly: task, focus and time manager for remote freelancers

Phase 0 + 1 of the roadmap: Kanban with drag and drop (mouse and keyboard), task detail drawer,
List view with sortable columns, search and client filter (kept in the URL), two-zone deadlines,
client clocks, EN/ID interface. All data lives in the browser (IndexedDB via Dexie); demo data is
seeded on first open.

Phase 2: a global time tracker and a Pomodoro focus mode.

- Start/stop a timer from the task drawer, or log minutes by hand; entries can be deleted.
  Only one timer runs at a time, it survives reloads, and the sidebar shows it on every page.
  Entries under 5 seconds are treated as accidental and dropped.
- Focus page (`#/focus`): focus / short break / long break (25/5/15, long break every 4 by default,
  all adjustable). Focus time is logged to the chosen task as `pomodoro` entries; breaks are not.
  A finished phase plays a chime, can send a desktop notification, and offers to start the next one.
  Starting the task timer by hand pauses a running Pomodoro.

Accounts (dummy, no backend): sign up / log in at `#/signup` and `#/login`; every other page needs a
session. Accounts live in IndexedDB (`users` table, password salted + SHA-256 hashed) and the session
in localStorage (`overlap.session`). Demo login: `demo@overlap.app` / `demo1234`, or the
"Try the demo account" button. All data is shared by accounts on the same browser. To connect a real
API later, replace `src/features/auth/auth.ts`.

Phase 3: Clients (`#/clients`). Each client shows local time, UTC offset and status (working, off
hours, asleep), a 24-hour timeline in your zone with your hours, their hours and the overlap, the
best time to send, and their rate. Step through days, set your own working hours ("My hours", saved
to your account), add/edit/archive/restore clients and manage their projects. Overlap is computed on
real instants, so daylight saving is handled per city; the page lists each zone's next clock change.

Phase 4: Weekly report (`#/reports`). Week navigation; tiles for tracked time (vs last week), average
per working day, tasks completed and focus sessions (10+ minutes); hours per day with the busiest day
highlighted; time share per client; a timesheet per client with hours, rate and amount in the client's
own currency; CSV export of every entry; a printable per-client PDF (browser "Save as PDF"); and a
progress update drafted from the week (done, in progress with steps and deadline, next step, time
logged) with a send-now / send-later hint from the client's hours, Copy and Open in email. Clients now
have an optional contact name and email for these updates.

Design (Taskly rebrand): blue brand colour (#2563EB) on cool slate neutrals, Plus Jakarta Sans,
rounded cards (`card` utility) and a blue hero surface (`brand-surface`); tokens live in `src/index.css`.
The home page (`#/`) is a dashboard: greeting and week summary, focus timer, task overview, upcoming
deadlines (tick to finish), this week's hours, clients right now and recent activity. Tasks moved to
`#/tasks`. The IndexedDB name and localStorage keys keep their old `overlap` prefix so data saved
before the rename is kept.

The `npm` scripts call `node node_modules/...` directly, because the Windows `.cmd` shims break on
folder paths containing `&`.

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # static site in dist/
    npm test           # unit tests (Vitest)
    npx playwright install chromium   # once, if you don't use the local Chrome
    npm run e2e        # browser tests (Playwright)

## Structure

    src/db/          Dexie schema, types, demo seed
    src/lib/         pure logic: board moves, filters/sort, time zones, Pomodoro state machine (unit tested)
    src/features/tasks/  Board, cards, list, drawer, page
    src/features/timer/  time entries, Pomodoro store + controller, sidebar timer, engine (alerts, tab title)
    src/features/focus/  Focus (Pomodoro) page
    src/features/auth/   dummy accounts, session, login/signup pages, route guard
    src/features/clients/  Clients page, client form, overlap timeline (logic in src/lib/overlap.ts)
    src/features/dashboard/  Dashboard home
    src/features/reports/  Weekly report, charts, CSV/PDF, progress update (logic in src/lib/report.ts)
    src/i18n/        English and Indonesian strings
    e2e/             Playwright tests
