# TaskFlow

A Tasks.org-inspired task manager built with Vue 3 + TypeScript. Stores data in IndexedDB by default, with optional Google Drive sync.

## Features

- ✅ Tasks with due dates, times & priorities (none / low / medium / high / critical)
- 🔁 Recurring tasks (daily, weekly, monthly, yearly with optional end date)
- 🏷 Tags with filtering
- 📂 Subtasks (unlimited nesting)
- ⭐ Starred / flagged tasks
- 📋 Custom lists with colors & icons
- 🔍 Full-text search
- ☁️ Optional Google Drive sync (minimal `drive.file` scope — only touches its own file)
- 📦 JSON import / export
- 📱 Responsive layout

## Quick Start

```bash
npm install
npm run dev
```

## Build & Deploy (GitHub Pages)

Push to `main`. The included GitHub Actions workflow auto-deploys to Pages.

**Before first deploy**, enable Pages in your repo:
`Settings → Pages → Source: GitHub Actions`

The base path (`/repo-name/`) is set automatically from `github.event.repository.name`.

## Google Drive Sync (optional)

This is a **developer/deployer setup** — done once. Users just click "Sign in with Google".

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create an **OAuth 2.0 Client ID** (Web application)
2. Enable the [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
3. Add your deployment URL to **Authorised JavaScript origins** (e.g. `https://yourname.github.io`)
4. On the [OAuth consent screen → Audience](https://console.cloud.google.com/auth/audience) page, click **Publish app** so any Google account can sign in (no verification needed for `drive.file` scope only)
5. Copy the Client ID

**Local dev:** copy `.env.example` to `.env.local` and fill in the Client ID.

**GitHub Pages:** add the Client ID as a repository secret named `GOOGLE_CLIENT_ID` in Settings → Secrets → Actions. The deploy workflow passes it automatically at build time.

The app only ever reads/writes a single file (`taskflow-data.json`) it created — no access to other Drive files.

## Project Structure

```
src/
  types/        — TypeScript interfaces
  utils/
    helpers.ts  — date & ID utilities
    storage.ts  — IndexedDB + JSON import/export
    gdrive.ts   — Google Drive sync
  stores/
    taskStore.ts  — tasks, lists, tags, filters (Pinia)
    driveStore.ts — Drive connection state (Pinia)
  components/
    Sidebar.vue       — smart views, lists, tags nav
    TaskListView.vue  — main view + quick-add
    TaskItem.vue      — single task row + subtasks
    TaskDetail.vue    — side panel full editor
    NewListModal.vue  — create list dialog
    SettingsModal.vue — Drive + import/export
  App.vue   — root layout
  main.ts   — entry point
```
