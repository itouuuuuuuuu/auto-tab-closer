# Auto Tab Closer

A Chrome extension that automatically closes tabs you haven't looked at for a configurable number of hours (default: 12). Pinned tabs are never touched.

## Features

- Closes tabs whose **last viewed** time is older than the threshold (uses `tab.lastAccessed`, Chrome 121+).
- Threshold is configurable from 1 to 720 hours; the check interval from 1 to 60 minutes (default: 10).
- Always keeps: pinned tabs, the active tab of each window, tabs playing audio, and the last tab in a window.
- Optional: keep tabs that belong to a tab group; hostname whitelist (`example.com` also matches every subdomain).
- Popup with a pause toggle, "check now" button, and a **recently auto-closed** list (up to 100) you can restore from with one click.
- Timers reset when the browser restarts, so a restored session is never mass-closed.
- UI in English and Japanese. No network access, no analytics. See [PRIVACY.md](PRIVACY.md).

## Install (unpacked)

```sh
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

## Development

```sh
npm run dev        # Vite dev server with HMR (load dist/ once, then edit freely)
npm test           # unit tests (Vitest)
npm run lint       # Biome
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate public/icons/*.png
npm run zip        # build dist/ into release/*.zip for the Web Store
```

## How it works

- A `chrome.alarms` alarm fires at the configured check interval (default: every 10 minutes). The service worker queries all tabs, builds snapshots, and hands them to a pure function (`src/core/select-tabs.ts`) that decides what to close.
- Last-access times come from `tab.lastAccessed`, falling back to timestamps recorded on `tabs.onActivated`. Tabs with no known time are never closed.
- Settings live in `chrome.storage.sync`; the pause toggle and recently-closed list live in `chrome.storage.local`; per-session tracking lives in `chrome.storage.session`.

## Releasing

Bump `version` in `package.json`, commit, and push a `v*` tag. GitHub Actions builds and attaches a Web Store-ready zip to the release.

## License

[MIT](LICENSE)
