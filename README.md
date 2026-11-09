# Mock Test Simulator

Timed CS fundamentals + DSA/SQL mock tests with a built-in code runner, Google sign-in and two roles.

- **Admin (you):** create assessments, invite students by email, watch progress, grade Set 2, release results.
- **Student:** signs in with Google, sees upcoming tests, takes them, and keeps a history of every attempt
  with their code, the solution links and (once released) scores, correct answers and your notes.

Built with Next.js 16 (App Router, Server Components, Server Actions, Partial Prerendering), shadcn/ui,
Auth.js (Google), Upstash Redis and nodemailer.

## Run it locally

Needs Node.js 20+.

```
npm install
cp .env.example .env.local      # then fill in what you have
npm run dev
```

Open http://localhost:3000. Without Upstash keys, data goes to `.data/dev-db.json`.

To try both roles without Google keys, put `AUTH_DEV_LOGIN=1` in `.env.development.local`. The sign-in
page then shows a "sign in as any email" form. It never turns on in a production build.
Any email listed in `ADMIN_EMAILS` signs in as admin; any email you've added as a student signs in as a student.

## Go live on Vercel

1. **Google sign-in.** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID →
   Web application. Add the redirect URI `https://<your-domain>/api/auth/callback/google`
   (and `http://localhost:3000/api/auth/callback/google` for local use). The consent screen can stay in
   "Testing" if you add your students as test users, or publish it.
2. **Environment variables** (Vercel → Project → Settings → Environment Variables):
   - `AUTH_SECRET`: run `npx auth secret` or `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: from step 1
   - `ADMIN_EMAILS`: your Google address (comma-separate several)
   - `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: optional, for invite emails. With Gmail, `SMTP_PASS` is an
     [App Password](https://myaccount.google.com/apppasswords). Without these, invites are still created
     and you share the link yourself ("Copy invite link").
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN`: already there from the Upstash integration.
   - `JUDGE_SNAPSHOT_ID`: the code-judge environment (see "Server-side judge" below).
3. Push to `main`. Vercel builds and deploys it (functions run in Mumbai, `bom1`, next to the database).

## Where things are

```
app/
  page.tsx                     landing page (static, prerendered)
  login/                       Google sign-in (+ dev sign-in locally)
  admin/                       overview, assessments, students, submissions, grading
  admin/actions.ts             every admin mutation (Server Actions, each checks the admin role)
  dashboard/                   student: upcoming tests, past attempts, results
  test/[id]/                   start screen + the exam; test/actions.ts starts and submits attempts
  api/judge/                   server-side grading in Vercel Sandbox (verdicts only for students)
  api/proctor/                 proctoring events and snapshots; api/proctor/shot serves snapshots to admins
components/exam/               exam workspace (client): Set 1 MCQs, Set 2 editor + runner output, proctoring
components/ui/                 shadcn/ui
lib/
  auth.ts, session.ts          Auth.js config; data access layer (role checked on every request)
  data.ts, kv.ts               Redis records and the Upstash REST client (file store in dev)
  papers/mock-01/              the question bank (Set 1 MCQs + answer key, Set 2 coding specs, tests)
  mail.ts                      invite emails
  judge/                       sandbox judge: harness scripts, SQL helpers, verdicts
public/runner/                 in-browser runtimes: Python (Pyodide), C++ (Clang/WASI), Java (CheerpJ), SQL (DuckDB)
proxy.ts                       bounces signed-out visitors to /login before rendering
```

## Data model (Redis)

| Key | What |
|---|---|
| `submissions` (hash) | one record per attempt. Same hash the first version used, so earlier attempts still show up |
| `assessments` (hash) | scheduled sittings of a paper: window, duration, "results released" |
| `students` (hash) | who may sign in as a student |
| `attempts` (hash) | invite + progress per student per assessment (`startedAt` is the server's clock) |
| `idx:*` (sets) | lookups by student / assessment, so pages never scan everything |

Attempts made before sign-in existed have no email. Open one under **Submissions → Not linked**, enter the
student's Gmail address, and it appears on their dashboard.

## Architecture and scaling

- **Server-first rendering.** Dashboards, admin pages and results are Server Components; the browser gets
  HTML, not data-fetching code. Each page is a prerendered static shell that the CDN serves instantly, with
  the per-user part streamed in (Partial Prerendering). Client JavaScript is limited to small interactive
  pieces (forms, menus) and the exam workspace, which loads lazily so CodeMirror never ships to other pages.
- **Mutations are Server Actions.** Every one re-checks the caller's role on the server.
- **Load balancing.** Vercel routes each request to the nearest edge and spreads server work across
  automatically scaled serverless instances, so there's no load balancer to run. The app is built to fit
  that model: no in-memory state on the server (sessions are signed cookies, data lives in Redis), and
  Upstash is reached over HTTPS with batched pipelines, so any number of instances can serve traffic
  without exhausting database connections.
- **Region.** Functions run in Mumbai (`bom1`, set in `vercel.json`), the same region as the Upstash database,
  so each database call is a millisecond hop instead of a round trip to the US.
- **Sample runs in the browser, grading on the server.** Run costs the server nothing; Submit runs in an isolated
  sandbox per request, so heavy grading never slows the web app.
- **Smaller exam payload.** The exam page ships only the sample tests (about 70 KB instead of 600 KB).
- **Less client work.** The React Compiler memoizes components automatically; the exam timer re-renders only itself,
  and Set 1 / Set 2 stay mounted so switching between them is instant.

## Server-side judge (hidden tests never reach the browser)

- **Run** (sample tests) runs in the browser for instant feedback; sample tests are public anyway.
- **Submit** sends the code to `/api/judge`. The server boots a fresh [Vercel Sandbox](https://vercel.com/docs/sandbox)
  microVM (no network, no secrets), compiles and runs the code against every test, and returns only verdicts.
  Hidden inputs, expected outputs and the program's output on hidden tests stay on the server.
- The score saved with a submission is the server's own record of the last Submit, not what the browser reports.
- Time limits per test: Python 4 s, Java 4 s, C++ 1 s. SQL runs in DuckDB with file access disabled.
- The environment (g++, a JDK, Python, DuckDB) is a snapshot built once:
  `vercel env pull .env.local && node tools/build-judge-snapshot.mjs`, then set the printed `JUDGE_SNAPSHOT_ID`.
  `npx tsx --conditions=react-server tools/try-judge.mts` checks it end to end.
- Cost: the Hobby plan includes 5 sandbox CPU-hours and 5,000 sandbox starts a month. One Submit is one start and
  a few CPU-seconds.

## Proctoring

On by default for every assessment (switch it off per assessment under **Visibility**). Before **Begin** unlocks,
the student must allow:

- **Camera + microphone**: a 320 px snapshot every minute; the microphone only measures loudness and flags
  sustained talking. Nothing is recorded continuously.
- **Entire-screen share**: a low-res screenshot every 3 minutes. Sharing a window or tab is refused.
- **Location**: recorded once at the start.

During the test, stopping the camera or screen share blocks the test until it's turned back on (the timer keeps
running), and these are logged: leaving the tab, switching windows, a second monitor, large pastes, sustained noise.
The admin sees the location, a flag summary, the snapshots and a timeline on each submission. Evidence is kept 90 days
and deleted with the submission. Proctored tests need a laptop or desktop (browsers on phones can't share the screen).

## Writing question papers (admin → Papers)

- **New paper** or **Duplicate** an existing one (the built-in paper is read-only; duplicate it to edit).
- **Multiple choice:** topic, question, optional code snippet, 2–6 options, the correct one, an explanation.
- **Coding:** title, statement, a function signature (types: int, long, double, bool, string, int[], long[],
  double[], string[], int[][], ListNode) and test cases as JSON argument lists. Starter code and test drivers for
  Python, Java and C++ are generated. Paste a reference solution: saving runs it on the judge to produce every
  expected output. A small Python generator can add hidden edge-case and large tests. Tick "any order" when a
  returned list may come back in any order.
- **SQL:** tables, datasets as JSON rows, and a reference query that produces each dataset's expected output.
- **Written:** a free-text question you grade by hand.
- Pick the paper when you create an assessment. Editing a paper changes every assessment that uses it.

## Editing the built-in paper in code

- `lib/papers/mock-01/questions.js`: config, the 28 MCQs (`answer` = index of the correct option) and the Set 2 list.
- `lib/papers/mock-01/set2.js`: coding statements, starter code and hidden drivers.
- Test cases are generated: edit `tools/make-tests.mjs`, then run `node tools/make-tests.mjs`.
- To add another paper, create `lib/papers/<id>/` and register it in `lib/papers/index.ts`. It then
  shows up in the "Question paper" picker when you create an assessment.

## Good to know

- Set 1 is graded on the server; the answer key never reaches the browser during a test.
- The timer is based on the server's start time. Closing the tab doesn't pause it, and the test submits
  itself when time runs out. Tab switches are counted.
- "Allow retake" on an invite lets a student sit the test again; the earlier attempt stays in their history.
