# SpendSnap PWA

A lightweight, mobile-first expense tracker designed for GitHub Pages.

## Included
- Five quick-entry categories: Online Orders, Petrol, Bike Expense, Food, Other Expense
- Dashboard totals for today and the current month
- Recent activity, searchable history, category summary
- Local device storage (IndexedDB, with one-time import from the older localStorage version)
- CSV export
- PWA manifest, app icon and offline service worker
- Large microphone button fixed in the bottom navigation
- Sherpa-ONNX WebAssembly speech recognition with an English Zipformer model
- Local audio processing and an editable transcript/review step before saving
- Voice engine/model cached on the device after first download

## Deploy to GitHub Pages
1. Extract this ZIP.
2. Upload **all files**, including `sherpa-worker.js`, to the repository root. Replace the older files.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Open the published HTTPS URL on your Android phone in Chrome.
7. Refresh SpendSnap. If it was already installed, close it fully and reopen it after the deployment updates.

## First-time voice setup
- The first time you tap the microphone, SpendSnap downloads about 40 MB of Sherpa-ONNX runtime and English model files from Hugging Face.
- The files are cached in browser storage on this device. Later recognition runs locally and can work without internet, provided the browser has not cleared the cached site data.
- The app does not upload recordings or transaction text.
- Allow microphone permission when Chrome asks.
- Speak one expense at a time, for example: “I spent 850 rupees on petrol at Indian Oil. I filled 7.5 litres.”
- Check the extracted amount/category/details in the existing manual-entry form and press Save. Voice recognition does not save an expense automatically.

## Important accuracy note
The bundled model is an English Zipformer model trained on LibriSpeech read speech. Recognition of Indian English accents, brand names, background noise, and numbers may vary. Always review the transcript and amount before saving.

## Privacy and storage
- Speech recognition runs locally in the browser using WebAssembly. Audio is not sent to a speech API.
- Expense data stays in this browser profile's IndexedDB database. Clearing site data can erase expenses and the downloaded model cache.
- Download a JSON backup from the Summary screen periodically; CSV export is also available.
- GitHub Pages must be accessed over HTTPS for microphone access, PWA installation, and service worker support.

## Model and runtime attribution
Sherpa-ONNX and the English Zipformer model are Apache-2.0 licensed. Model files are downloaded from the pinned Hugging Face revision `909bffc2f4de5447907a9fd25161dd1170324f1d` of `wundr-ai/zipformer-small-librispeech-en-wasm`.


## Fix in this build
The Sherpa package preloads the model as `/transducer-encoder.onnx`, `/transducer-decoder.onnx`, `/transducer-joiner.onnx`, and `/tokens.txt`. The earlier build referenced generic filenames that were not present in the package. This build checks the expected files before creating the recognizer and reports a useful setup error if any are missing.
If you previously downloaded the voice model, deploy this update and then use Chrome site settings to clear the cached site data for the SpendSnap site only if the app reports that cached model files are incomplete. Your expense records are stored in localStorage, so export a CSV backup before clearing site data.


## Expense storage update (IndexedDB)
- New expenses are stored in the phone browser's IndexedDB database (`SpendSnapDB`), not `localStorage`.
- On first launch after this update, the app imports existing `spendsnap_expenses` localStorage records into IndexedDB exactly once. The original localStorage records are deliberately left untouched as a safety copy.
- History now has Edit and Delete actions. Editing updates the existing record rather than creating a duplicate.
- Summary includes Download backup (JSON) and Restore backup. On Android Chrome, the downloaded JSON file normally appears in Downloads and can be copied elsewhere.
- CSV export remains available.
- Clearing browser/site data can still delete the IndexedDB database. Download a JSON backup periodically. A PWA cannot silently write arbitrary files into Android storage; the user initiates backup download and restore file selection.
- Keep the same GitHub Pages origin when updating so the existing localStorage migration can find the previous app's data.


## UI refresh
- Removed the introductory "Your money, at a glance" and "Keep track. Stay in control." text.
- Removed the recent-activity preview from Home to keep the five expense category buttons visible without scrolling.
- Reworked the Home dashboard into a compact layout with the monthly total, today's total, entry count, five category cards, and the fixed bottom navigation/microphone.
- Added short-screen responsive sizing and safe-area spacing. Other screens (History, Summary, entry forms, and voice panel) remain scrollable where needed.


## All-screen usability refresh
- Refined entry forms with consistent labels, larger input targets, clearer spacing and prominent save actions.
- Refined History cards, dates, amounts, search/filter sizing, and separate Edit/Delete actions.
- Refined Summary totals, category breakdown rows, and backup/restore controls.
- Improved voice panel sizing and scrolling on short screens.
- Added keyboard focus indicators and narrow-screen responsive adjustments.
- Existing IndexedDB storage, one-time legacy migration, JSON backup/restore, CSV export, expense edit/delete, and Sherpa worker are retained.


## Verification notes
- JavaScript syntax and ZIP structure were checked for this build.
- The app still needs a real-device test on Android Chrome, including microphone permission, first-time model download, offline voice recognition, IndexedDB persistence, and JSON restore. Do not treat voice recognition as verified until those tests pass.


## Home screen voice entry update (v9)
- Category buttons have larger tap targets.
- Voice entry is embedded below the category buttons on the home screen; it does not open a separate page or modal.
- Tapping Speak an expense expands the inline voice area, initializes the local speech engine if needed, and automatically requests microphone access and starts recording when the engine is ready.
- Tap the recording control to stop, review the recognised text, then choose Review expense details.
- The home screen can scroll when the inline voice area is expanded.
