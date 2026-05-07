  <p align="center">
    <a href="https://odio.love">                                                                                                                                      
      <img src="https://odio.love/logo.png" alt="odio" width="160" />
    </a>
  </p>
  <h1 align="center">odio-pwa</h1>
  <p align="center"><em>Progressive web app to manage all your odio instances from one place.</em></p>
  <p align="center">                                                                                                                                                                                       
    <a href="https://github.com/b0bbywan/odio-pwa/releases"><img src="https://img.shields.io/github/v/release/b0bbywan/odio-pwa?include_prereleases" alt="Release" /></a>
    <a href="https://github.com/b0bbywan/odio-pwa/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-BSD--2--Clause-blue" alt="License" /></a>
    <a href="https://github.com/b0bbywan/odio-pwa/actions/workflows/ci.yml"><img src="https://github.com/b0bbywan/odio-pwa/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/sponsors/b0bbywan"><img src="https://img.shields.io/github/sponsors/b0bbywan?label=Sponsor&logo=GitHub" alt="GitHub Sponsors" /></a>
  </p>
  <p align="center">
    <a href="https://pwa.odio.love"><img src="https://img.shields.io/badge/Live%20app-5ab81e" alt="Live at pwa.odio.love" /></a>
    <a href="https://docs.odio.love/guides/pwa/#multiple-nodes"><img src="https://img.shields.io/badge/Multi--node-5B21B6" alt="Multi-node" /></a>
    <a href="https://docs.odio.love/guides/pwa/#installation"><img src="https://img.shields.io/badge/PWA%20install-BC52EE" alt="PWA install" /></a>
    <a href="https://docs.odio.love/guides/pwa/#other-setups"><img src="https://img.shields.io/badge/Self--host-334155" alt="Self-host" /></a>
    <a href="https://docs.odio.love/guides/embedded-ui/"><img src="https://img.shields.io/badge/Embedded%20UI-F18D00" alt="Embedded UI" /></a>   
  </p>
  <p align="center">
    Part of the <a href="https://odio.love">odio</a> project — <a href="https://docs.odio.love/guides/pwa/">full documentation</a>.
  </p>
  <p align="center">
    <a href="https://svelte.dev/"><img src="https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white" alt="Svelte" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" /></a>
    <a href="https://github.com/features/actions"><img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions" /></a>
    <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" /></a>
    <a href="https://github.com/b0bbywan/odio-pwa/pkgs/container/odio-pwa"><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>       
  </p>   
  
  # odio-pwa

Progressive Web App for discovering and controlling [odio-api](https://github.com/b0bbywan/go-odio-api) instances on your local network.

Manage multiple odio-api endpoints from a single interface — add instances manually, monitor their status, and connect to their embedded web UI via iframe with one-tap switching.

## Features

- **Instance management** — add, edit, delete odio-api instances (IP/hostname + port), persisted in localStorage
- **Deep linking** — open an instance directly via `#/i/<host>/<port>?label=<name>` (port and label optional). First-time visits stay in-memory only and prompt to save on exit, so QR codes and shared links don't silently pollute the user's list
- **Real-time status** — live updates via SSE (`/events`), up to 6 concurrent connections; additional instances fall back to HTTP polling every 30 s
- **Smart reconnect** — exponential backoff on connection loss (1 s → 30 s cap); gives up after 90 s of consecutive failures
- **Power event handling** — reboot shows a waiting screen and auto-reloads when the server comes back; poweroff offers to wait or go back to the list immediately; servers without SSE support are detected automatically and use polling only
- **Embedded UI** — loads each instance's `/ui` in a full-screen iframe
- **Quick switch** — compact top bar with dropdown to jump between online instances
- **PWA** — installable, offline-capable app shell, service worker caching
- **Dark theme** — responsive layout (single column on mobile, grid on desktop)
- **In-app diagnostics**: Firefox / Safari desktop on HTTPS get a persistent banner and a disabled "+ Add Instance" button; instance cards distinguish *Server unreachable*, *Server reachable: missing CORS headers*, and *Browser blocked (mixed content)* so the user knows what to fix

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
│   ├── types.ts            # OdioServerInfo, OdioInstance, PowerEvent
│   ├── api.ts              # probeInstance(), getInstanceUiUrl()
│   ├── sse.ts              # connectSSE() — thin EventSource wrapper
│   ├── connection.ts       # createConnection() — backoff, give-up, SSE/polling
│   └── state.svelte.ts     # Reactive state (Svelte 5 runes), instancePath() helper
├── components/
│   ├── InstanceList.svelte    # Discovery screen with card grid
│   ├── InstanceCard.svelte    # Status indicator, server info, actions
│   ├── AddInstanceForm.svelte # Add/edit form (host, port, label)
│   ├── InstanceTopBar.svelte  # Navigation bar with instance switcher + Save button
│   ├── PowerScreen.svelte     # Full-screen reboot/poweroff state display
│   ├── InstanceView.svelte    # Iframe embed, power event orchestration, save prompt
│   └── ReloadPrompt.svelte    # PWA update toast
├── App.svelte               # Hash routing (svelte-spa-router): / and /i/:host/:port?
├── app.css                  # Global styles, dark theme
└── main.ts                  # App bootstrap
```

### Tech stack

- [Svelte 5](https://svelte.dev/) with runes (`$state`, `$derived`, `$effect`)
- [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router) for hash-based deep linking
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

### Deep links

You can also open an instance straight from a URL:

```
https://pwa.odio.love/#/i/<host>[/<port>][?label=<name>]
```

- `host` is required, `port` defaults to `8018`, `label` is optional
- Examples: `#/i/192.168.1.10`, `#/i/odio.local/9000?label=Living%20Room`
- The instance is held in-memory only; a **Save** button appears in the top bar to persist it, and leaving without saving (in-app or browser back) prompts to Save / Don't save / Cancel

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

## Self-hosting

A Docker image is published to GHCR for each `v*` tag, alongside a zip of the static build attached to the GitHub Release.

### Docker (recommended)

```bash
docker run -d -p 8080:80 --restart unless-stopped \
  --name odio-pwa ghcr.io/b0bbywan/odio-pwa:latest
```

The image is multi-arch (`linux/amd64`, `linux/arm64`) and ships an nginx configured for SPA routing and PWA cache headers.

### Static zip

Download `odio-pwa-<version>.zip` from the [Releases](https://github.com/b0bbywan/odio-pwa/releases) page and serve the extracted files with any static web server. Make sure to:

- rewrite unknown routes to `/index.html` (SPA fallback)
- serve `/index.html`, `/sw.js`, `/registerSW.js` with `Cache-Control: no-cache` so PWA updates propagate

### HTTPS and mixed content

The PWA makes **HTTP** calls to your odio-api instances on the LAN. When the PWA itself is served over HTTPS (e.g. behind a public reverse proxy), behavior varies by browser:

- **Chrome 142+** shows a [Local Network Access](https://developer.chrome.com/blog/local-network-access) permission prompt on the first HTTP LAN call; granting it bypasses the mixed-content block for private IPs, `.local` domains, and loopback.
- **Safari** (iOS/macOS) blocks mixed-content fetches strictly — [no LAN exemption in WebKit](https://bugs.webkit.org/show_bug.cgi?id=171934).
- **Firefox** exempts `localhost` / `.localhost`, but private IPs are still blocked ([MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)).

Serving the PWA over plain HTTP on the LAN avoids all of this.

#### In-app feedback

When the PWA detects Firefox or Safari desktop on an HTTPS context, it shows a persistent banner pointing back at this guide and disables the "+ Add Instance" button (no point in adding nodes that cannot be reached).

When a probe fails for an existing instance, the card distinguishes three cases by re-probing with `mode: 'no-cors'`:

- *Server unreachable* (red): the server is genuinely down, or the request was blocked at the network layer.
- *Server reachable: missing CORS headers* (amber): the request round-tripped but the response lacks `Access-Control-Allow-Origin`. Add the PWA's origin to the node's `api.cors.origins`.
- *Browser blocked (mixed content)* (amber): both the regular and `no-cors` probes failed on an HTTPS PWA, so a browser-level block is the most likely cause.

### Update indicator

The app checks GitHub for a newer stable release and shows an arrow next to the version when one is available. By default prereleases are ignored. To also surface prereleases (useful when testing an RC image), run this in the browser devtools:

```js
localStorage.setItem('odio-include-prereleases', 'true'); location.reload();
```

To revert: `localStorage.removeItem('odio-include-prereleases'); location.reload()`.

## License

[BSD-2-Clause](LICENSE)
