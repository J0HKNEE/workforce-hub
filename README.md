# Workforce & Attendance Dashboard

A static, GitHub-hosted dashboard for tracking staffing, attendance, and
headcount. Data is fed by Microsoft Forms responses that you export to
CSV and commit to this repo.

## How data flows

```
Microsoft Forms response
        │
        ▼
Excel workbook attached to the Form (auto-synced by Microsoft)
        │
   File → Save As → CSV
        ▼
public/data/attendance.csv   ← commit to GitHub
        │
        ▼
GitHub Actions builds + deploys to GitHub Pages
        │
        ▼
Dashboard re-renders with latest data
```

No backend, no webhook server, no database. Everything is a static
build plus two CSV files.

## CSV files

### `public/data/employees.csv`
The roster. One row per active employee.

| column      | example         |
| ----------- | --------------- |
| employee_id | E001            |
| name        | Alex Rivera     |
| team        | Operations      |
| location    | HQ              |
| manager     | Jamie Chen      |
| status      | Active          |

### `public/data/attendance.csv`
One row per employee per day. Append new rows; never edit history
unless correcting an error.

| column      | example                                       |
| ----------- | --------------------------------------------- |
| date        | 2026-06-10 (YYYY-MM-DD)                       |
| employee_id | E001                                          |
| type        | Present \| Absent \| PTO \| ShortShift \| Makeup |
| hours       | 8                                             |
| notes       | Sick / Vacation / etc.                        |

## Updating data from Microsoft Forms

1. Open the Excel workbook linked to your attendance Form.
2. `File → Save As → CSV UTF-8`.
3. Match columns to the schema above (rename headers if needed).
4. Replace `public/data/attendance.csv` in this repo and commit.
5. Push to `main` — GitHub Actions deploys within ~2 minutes.

Tip: a Power Automate flow can write the Excel rows to a CSV in
OneDrive on a schedule; a second Action job can `git commit` that
file. Out of scope for this starter.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Repo `Settings → Pages → Build and deployment → Source: GitHub Actions`.
3. If your repo is `user/repo-name` (not `user.github.io`), set
   `BASE_PATH` in `.github/workflows/deploy.yml` to `/repo-name`.
4. Push to `main`. The included workflow builds and publishes.

## Running locally

```
bun install
bun run dev
```

Edit the CSVs under `public/data/` and the dashboard hot-reloads.

## Limitations of the static / GitHub-Pages approach

- No authentication — anyone with the URL sees the dashboard. Use a
  private repo + GitHub Pages with restricted access, or host
  internally.
- No live webhook from Forms — data is only as fresh as the last CSV
  commit.
- No PTO accruals, approvals, or write-back from the UI.

If you outgrow this, the same UI can be repointed at a live API
without a rewrite — replace the two `fetch("/data/*.csv")` calls in
`src/lib/attendance.ts`.
