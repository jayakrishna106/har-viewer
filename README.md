# HAR Viewer Standalone

A no-build static web application for inspecting `.har` files locally.

## Features

- Load HAR files directly in the browser.
- Browse all entries with filtering by method, URL, and status.
- Keyboard navigation for entries (↑/↓ to move focus, Enter/Space to select).
- Inspect request/response metadata and headers.
- Preview response/request bodies:
  - formatted JSON
  - plain text
  - images
  - audio/video
- Download request or response body payloads.

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.
