# CS Fundamentals & DSA Assessment

- `/`           → the test link you send your brother
- `/admin.html` → your results dashboard (password protected)

## Try it locally first

Needs Node.js 18 or newer (check with `node -v`). No npm install, no account, no database.

```
cd brother-test
npm run dev
```

- Test page: http://localhost:3000
- Admin page: http://localhost:3000/admin.html (password: `admin`)

Submissions are kept in memory and cleared when you stop the server (Ctrl+C).
To use a different password: `ADMIN_PASSWORD=yourpass npm run dev` (Mac/Linux) or
`set ADMIN_PASSWORD=yourpass && npm run dev` (Windows cmd).

## Deploy on Vercel (free, ~10 minutes)

1. **Put the code on GitHub.** Create a new *private* repo and upload this folder
   (drag-and-drop on github.com works, or `git init && git add . && git commit -m init && git push`).
   Keep it private: `lib/questions.js` contains the answer key.
2. **Import into Vercel.** vercel.com → Add New → Project → pick the repo.
   Framework preset: **Other**. Leave build settings empty. Click Deploy.
3. **Add a free database.** In the project: Storage → Create Database → **Upstash for Redis** (free plan)
   → connect it to this project. Vercel adds the database keys as environment variables automatically.
4. **Set your admin password.** Settings → Environment Variables → add
   `ADMIN_PASSWORD` = something only you know.
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect.

Done. Send `https://<your-project>.vercel.app` to your brother and open
`https://<your-project>.vercel.app/admin.html` yourself.

## Editing the test

Everything lives in `lib/questions.js`:

- `CONFIG` — title, duration, marks per MCQ, negative marking, and whether he sees his Set 1 score after submitting.
- `SET1` — the 28 MCQs. `answer` is the index of the correct option (0 = A, 1 = B, …).
- `SET2` — the 6 written questions. Fill in `title`, `link` and `prompt` for each, and adjust `marks`.

Commit the change and Vercel redeploys on its own.

## Set 2 coding questions

- Statements, starter code and the hidden test drivers are in `lib/set2.js`.
- Test cases are generated: edit `tools/make-tests.mjs`, then run `node tools/make-tests.mjs`
  to rewrite `lib/set2-tests.js` (expected outputs come from reference solutions in that script).
- Code runs in the candidate's browser, so there's no server cost and no API key:
  Python (Pyodide), C++17 (Clang compiled to WebAssembly), Java 8 (CheerpJ + `public/runner/java/tools.jar`),
  SQL (DuckDB, accepting MySQL / Spark SQL style). The first run of each language downloads its runtime
  (C++ is the largest, about 100 MB), then the browser caches it.
- Run = sample tests, Submit = all tests (hidden ones included). The last Submit result is saved with the
  answers. On the admin page, "Re-run tests here" runs the submitted code again in your browser.
- Test inputs reach the browser (that's where the code runs), so hidden tests are hidden from view, not secret.
- After editing anything in `lib/`, restart `npm run dev`; the local server caches those modules.

## Good to know

- Set 1 is graded on the server, so the answer key never reaches his browser.
- Set 2 is graded by you on the admin page (marks + optional note per answer).
- His answers autosave in his browser, so a refresh or crash doesn't lose work.
- The test auto-submits when time runs out, and tab/window switches are counted.
- After submitting, that browser shows "Submitted" instead of the test. If you try the test
  yourself first, use an incognito window, then delete your trial entry from the admin page.
