# OCR / handwriting status

StudyWell's ingestion pipeline has a strict rule: **untrusted text is never passed into the study generators**.

For a PDF whose embedded text layer is corrupted or absent, the page is classified as `OCR needed` and skipped. This is why the app may show fewer indexed pages than the PDF contains.

This is intentional. A fully offline browser build should not claim handwriting recognition that it has not validated. High-quality handwriting recognition generally requires a dedicated local HTR model, which adds substantial model size and compute requirements.

The architecture leaves a clean insertion point for a local OCR/HTR worker later:

PDF.js page image -> local OCR/HTR -> quality gate -> normalized page text -> IndexedDB -> Ask / Exam Prep / Flashcards / Practice

Until that model is bundled and tested on representative handwritten notes, the safe behavior is to surface the unread pages rather than manufacture study content from gibberish.
