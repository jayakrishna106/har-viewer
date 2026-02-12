# HAR Viewer Standalone

A lightweight standalone web app for viewing `.har` files.

## Features

- Load HAR files directly in the browser.
- Browse all entries with filtering.
- Inspect request/response metadata and headers.
- Preview image, audio, and video responses.
- View text/JSON payloads.
- Download any available response body.

## Run locally

This is a static app. Open `index.html` directly, or run a simple web server:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.
