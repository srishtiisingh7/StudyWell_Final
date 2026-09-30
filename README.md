# StudyWell — Curated Offline Build

StudyWell is a private, offline-first study companion built with plain HTML/CSS/JavaScript and bundled PDF.js.

## Curated UI system

This release uses only the Aceternity patterns supplied for this build, adapted to the existing vanilla/offline architecture:

- **Sidebar** — primary desktop navigation with collapse state.
- **Floating Dock** — compact mobile navigation.
- **Lamp** — calm hero/page-heading treatment.
- **Bento Grid** — dashboard statistics and study tools.
- **Glowing Effect** — subtle interactive card edge aura.
- **Card Spotlight** — cursor-following local spotlight on cards.
- **Expandable / Flip Cards** — Exam Prep topic cards with front/back study breakdowns.
- **File Upload** — PDF drag/drop and local import.
- **Stateful Button** — processing/success feedback for practice and note search actions.
- **cn / useOutsideClick concepts** — represented within the existing vanilla interaction architecture.

The React/Tailwind demo snippets were intentionally **adapted rather than shipped as React dependencies**, because StudyWell's runtime remains plain HTML/CSS/JS and works offline without npm or a network connection.

## Core study behavior

- Local PDF parsing with bundled PDF.js.
- IndexedDB storage on the device.
- Local retrieval/search over usable extracted text.
- Exam Prep flip cards grounded in indexed passages.
- Question-first flashcards for active recall.
- Practice questions from the local study engine.
- Focus timer.
- Source-page references.
- A quality guard that rejects obviously corrupted PDF text layers instead of feeding gibberish into study features.

## Handwritten/scanned PDFs

StudyWell does **not** pretend that PDF.js is handwriting OCR. Pages whose embedded text is missing or visibly unreliable are marked as needing OCR and are skipped by the study generator. This prevents corrupted text from becoming fake flashcards or exam answers.

High-quality handwriting recognition would require an additional local OCR/HTR model; that model is not bundled in this release.

## Run

### Windows

Double-click `run.bat`.

### Any local Python installation

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

The service worker and all runtime assets are local. No API key or cloud backend is required.

## Files

- `index.html` — application shell
- `css/style.css` — Apple-inspired visual system + curated interactions
- `js/app.js` — UI, navigation, storage, study flows
- `js/engine.js` — local extraction, quality checks, retrieval and study generation
- `vendor/` — bundled PDF.js runtime
- `sw.js` — offline cache
- `manifest.webmanifest` — installable web app metadata
