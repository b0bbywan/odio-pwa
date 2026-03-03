# odio-pwa

Progressive Web App for discovering and controlling [odio-api](https://github.com/b0bbywan/go-odio-api) instances on your local network.

Manage multiple odio-api endpoints from a single interface — add instances manually, monitor their status, and connect to their embedded web UI via iframe with one-tap switching.

## Features

- **Instance management** — add, edit, delete odio-api instances (IP/hostname + port), persisted in localStorage
- **Real-time status** — live updates via SSE (`/events`), up to 6 concurrent connections; additional instances fall back to HTTP polling every 30 s
- **Smart reconnect** — exponential backoff on connection loss (1 s → 30 s cap); gives up after 90 s of consecutive failures
- **Power event handling** — reboot shows a waiting screen and auto-reloads when the server comes back; poweroff offers to wait or go back to the list immediately; servers without SSE support are detected automatically and use polling only
- **Embedded UI** — loads each instance's `/ui` in a full-screen iframe
- **Quick switch** — compact top bar with dropdown to jump between online instances
- **PWA** — installable, offline-capable app shell, service worker caching
- **Dark theme** — responsive layout (single column on mobile, grid on desktop)

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- One or more [odio-api](https://github.com/b0bbywan/go-odio-api) instances running on your network

## Installation

```bash
git clone https://github.com/b0bbywan/odio-pwa.git
cd odio-pwa
npm install
```

## Development

Start the dev server:

```bash
npm run dev
```

Opens at `http://localhost:5173` by default.

Run type checking:

```bash
npm run check
```

### Project structure

```
src/
├── lib/
│   ├── types.ts            # OdioServerInfo, OdioInstance, AppView
│   ├── api.ts              # probeInstance(), getInstanceUiUrl()
│   ├── sse.ts              # connectSSE() — thin EventSource wrapper
│   ├── connection.ts       # createConnection() — backoff, give-up, SSE/polling
│   └── state.svelte.ts     # Reactive state (Svelte 5 runes, class pattern)
├── components/
│   ├── InstanceList.svelte    # Discovery screen with card grid
│   ├── InstanceCard.svelte    # Status indicator, server info, actions
│   ├── AddInstanceForm.svelte # Add/edit form (host, port, label)
│   ├── InstanceTopBar.svelte  # Navigation bar with instance switcher
│   ├── PowerScreen.svelte     # Full-screen reboot/poweroff state display
│   ├── InstanceView.svelte    # Iframe embed, power event orchestration
│   └── ReloadPrompt.svelte    # PWA update toast
├── App.svelte               # View routing (list ↔ instance)
├── app.css                  # Global styles, dark theme
└── main.ts                  # App bootstrap
```

### Tech stack

- [Svelte 5](https://svelte.dev/) with runes (`$state`, `$derived`, `$effect`)
- [Vite](https://vite.dev/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) with Workbox
- [Vitest](https://vitest.dev/) + [@testing-library/svelte](https://testing-library.com/docs/svelte-testing-library/intro) for unit and component tests

Run tests:

```bash
npm run test
```

## Build & Preview

```bash
npm run build
npm run preview
```

The production build outputs to `dist/`. The preview server serves it at `http://localhost:4173`.

## Usage

1. Open the app in your browser
2. Tap **+ Add Instance** and enter the IP/hostname and port (default `8018`) of an odio-api instance
3. The app probes `/server` to check if the instance is online
4. Tap **Connect** on an online instance to load its UI in an iframe
5. Use the **switch dropdown** in the top bar to jump between instances

## Technical notes

### SSE support

odio-pwa uses Server-Sent Events (`/events`) for real-time status updates when the odio-api version supports it. If the endpoint is not available (404 or connection error before the stream opens), the app automatically falls back to HTTP polling every 30 s — no configuration required.

### CORS

The status probe (`fetch /server`) and the SSE stream (`fetch /events`) are cross-origin requests. Your odio-api instances must respond with:

```
Access-Control-Allow-Origin: *
```

For those using https://odio-pwa.vercel.app, odio-api already support the appropriate header

The iframe loading `/ui` does **not** require CORS headers.

### PWA

The service worker caches only the app shell (HTML, CSS, JS, icons). It does not cache cross-origin requests to odio-api instances. The app is installable on supported browsers and works offline (showing the cached instance list — instances will appear as offline until the network is available).

## License

[BSD-2-Clause](LICENSE)
