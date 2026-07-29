# DICOM Modality Emulator

A lightweight web app that emulates a DICOM imaging modality. It queries a **Modality Worklist (MWL)**, sends **MPPS** (Modality Performed Procedure Step) `IN PROGRESS` / `COMPLETED` messages, and pushes DICOM images to a PACS via **C-STORE** — all driven from a browser UI, useful for testing DICOM-receiving systems (PACS, RIS, dcm4chee, Orthanc, etc.) without real modality hardware.

## Features

- Query a worklist server (C-FIND) and filter by date, patient name, or accession number
- Manually enter a study when no worklist is available
- Pick a folder of sample `.dcm` files to send as the study's images
- Full send sequence: `MPPS N-CREATE (IN PROGRESS)` → `C-STORE` (each image) → `MPPS N-SET (COMPLETED)`
- Live log and step/progress tracking in the UI via Server-Sent Events
- Per-connection settings (host/port/AE title) for MWL, MPPS, and Store, configurable from the UI and saved in the browser (`localStorage`)

## Requirements

- [Node.js](https://nodejs.org/) 16+ (uses `dcmjs-dimse`, `express`, `uuid`)
- A reachable DICOM MWL SCP and a DICOM Storage/MPPS SCP (e.g. [dcm4chee](https://github.com/dcm4che/dcm4chee), [Orthanc](https://www.orthanc-server.com/), or your own test PACS) — or run your own for local testing

## Install

```bash
git clone https://github.com/dinseangmeng/dicom-emulator.git
cd dicom-emulator
npm install
```

## Sample DICOM images

The emulator sends images from the `samples/` folder. Each **subfolder** of `samples/` represents one "study" of images and should contain one or more `.dcm` files (nested subdirectories are fine too, e.g. `samples/CT_SCAN_01/.../*.dcm`).

Get sample data one of two ways:

**Download a small public sample set** (from [pydicom-data](https://github.com/pydicom/pydicom-data)):

```bash
npm run download
```

This creates individual sample files under `samples/` and writes `samples/manifest.json`.

**Or use your own `.dcm` files** — drop them into subfolders under `samples/`, e.g.:

```
samples/
  CT_CHEST_01/
    image001.dcm
    image002.dcm
  MR_BRAIN_01/
    image001.dcm
```

Then (optional) regenerate the manifest / label guesses:

```bash
node update-manifest.js
```

The app itself only needs folders containing `.dcm` files under `samples/` — it scans that directory at runtime, so `manifest.json` is not strictly required for the main emulate flow.

## Running

```bash
npm start
```

This starts the server (default port `3000`). Open:

```
http://localhost:3000
```

## Environment variables

| Variable | Default | Description |
|----------|---------|--------------|
| `PORT`   | `3000`  | Port the web UI/API server listens on |

There is no `.env` file — set the variable inline if you need a different port:

```bash
PORT=8080 npm start
```

All **DICOM network settings** (MWL / MPPS / Store host, port, AE titles, and the emulator's own Calling AE Title) are configured through the app's **⚙ Settings** modal in the browser, not via environment variables. They are stored in the browser's `localStorage`, so they persist across reloads on the same machine/browser but are per-client, not server-side config.

## Usage

1. Start the app and open it in your browser.
2. Click **⚙ Settings** and set the connection details for each DICOM service:
   - **Worklist (MWL)** — host/port/AE title of the C-FIND SCP to query
   - **MPPS** — host/port/AE title of the MPPS SCP
   - **C-STORE (PACS)** — host/port/AE title of the storage SCP
   - **Calling AET** — the AE title this emulator presents as
   
   Click **Save**.
3. Choose a source for the study, using the two tabs on the left:
   - **Worklist (MWL)** — click **⟳ Refresh** to query the worklist server, optionally filter by date/name/accession, then click an item to select it.
   - **Manual Entry** — fill in patient/study fields yourself (Patient Name, Patient ID, Accession Number, and a sample folder are required).
4. Once a study is selected, pick a **Sample Folder** (worklist tab) — this is the set of `.dcm` files that will be sent as that study's images.
5. Click **▶ Send to PACS**. The right panel shows live progress through three steps:
   1. MPPS `IN PROGRESS`
   2. C-STORE of each image
   3. MPPS `COMPLETED`
