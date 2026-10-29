# Daily Standard

A mobile-first, offline-capable accountability tracker. Plain HTML/CSS/JavaScript: no framework, API key, subscription or server required.

## What it tracks

- **Daily:** 3,000 calories; room reset, shower, AM and PM teeth brushing, first meal, planned vitamins/supplements, reading, email inbox caught up, and no smoking.
- **Monday–Friday:** at least 100 sales calls and 90 minutes of additional AresFit work **after 6pm**, outside call hours.
- **Saturday–Sunday:** 16 hours of work **combined** across the two days. Log hours separately on each day; the shared target is counted once, on Sunday.
- **Training:** four training days each Monday–Sunday week; up to three rest days count as valid. A fourth rest day is a missed standard. Mark trained, rest, or missed; if trained, optionally select your split.
- **Accountability:** close the day with reasons for any unmet standards. Missing days count as incomplete in the monthly review. The current day isn't counted until closed.
- **One-off tasks:** optional and *not part of the score*.
- **History:** completion calendar, 100% days, monthly consistency and weekly totals.

The calorie target is a personal logging target, not a health recommendation. Take only supplements you have a reason to use, following their instructions.

## Put it on GitHub Pages

1. Log in to https://github.com and create a **new public repository** called `daily`. Initialise with a README if GitHub requires it.
2. Upload the *contents* of this folder **at the repository root**: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, the `icons/` folder, and this README. GitHub's **Add file → Upload files** accepts multiple files and folders using desktop drag-and-drop, or upload using Git on your computer.
3. Commit to `main`.
4. Open the repo's **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, then choose **main** and **/(root)**, and **Save**.
5. After publishing, GitHub Pages shows the website address. For your connected GitHub username, it should be `https://michaelini0309.github.io/daily/`.
6. On your iPhone, open that link in **Safari → Share → Add to Home Screen**. If present, enable **Open as Web App**, then tap **Add**.
7. Use the *home-screen icon* to log your days. Set a daily reminder separately in the iPhone Clock or Reminders app.

GitHub Pages serves a public copy of the **app code**. Your personal calorie/call/checklist records are **not committed to GitHub** and are not publicly visible.

## Important: how data is saved

All entries are held in your device's browser/web-app `localStorage`, under the key `daily-standard-v1`. Nothing is sent to an account or cloud. This is an intentional first version of the app, not cross-device sync.

**Export a backup regularly** via **Settings → Download backup**. You can import the JSON later if you replace your phone or clear browsing data. You can also export CSV for review. On iPhone, an installed home-screen web app may use a different storage area from a Safari browser tab: use the same icon consistently and create an early backup after your first entry. Do not use Private Browsing for this app.

Offline use is available after a successful online visit that installs its service worker. Cache is separate from your saved history.

## Run locally

Open `index.html` in a browser to view the interface. For service worker/offline testing, serve it over localhost using:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Scoring choices

- Every applicable daily requirement carries equal weight; no score is awarded for tasks merely being added.
- A 100%-day requires every applicable requirement, including correctly recorded training/rest status.
- A day can be closed below 100% only when every missed requirement has a saved reason. This does not disguise the miss or change the score.
- A rest day counts positively if it's among the first three rest days in that calendar week. A fourth rest day doesn't pass; historical results recalculate if earlier days are edited.
- Weekly work hours are scored **on Sunday only** (the combined Saturday + Sunday target). No artificial 16-hour minimum is imposed on Saturday.
- Workweek standards aren't applied on weekends. Daily habits still apply every day.
- Monthly history starts on the first day you open the app. Unlogged past days lower the historic score; the active day counts after closure.
- Editing target values later recalculates past results with your new standards. For an exact historical record of old targets, export periodic backups.

## Files

- `index.html`: app structure and iPhone PWA metadata
- `styles.css`: responsive dark UI
- `app.js`: persistence, scoring, history, interactions
- `manifest.webmanifest`, `sw.js`, `icons/`: installation/offline support