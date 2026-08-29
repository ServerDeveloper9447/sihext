# AetherDOM AI — Hybrid Vision & DOM Agent

A modern Chrome Extension (Manifest V3) built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **CRXJS**. It features an intelligent dual-engine architecture with **Set-of-Mark (SoM) DOM Annotation**, **Offscreen Canvas Redaction**, **On-Device ViT**, a **Self-Hosted Model Backend**, and rich **React + Tailwind UI** interfaces.

---

## 🚀 Key Capabilities

1. 🏷️ **Set-of-Mark (SoM) DOM Annotation**:
   - Automatically scans all visible interactive DOM elements (`button`, `a`, `input`, `select`, etc.).
   - Assigns unique integer IDs (`1`, `2`, `3`...) and injects high-contrast semi-transparent overlay boxes with bold ID badges.

2. 🛡️ **DOM PII & Visual Face Redaction**:
   - **DOM PII Discovery**: Locates sensitive inputs (`type="password"`, `autocomplete*="cc-"`, credit cards, SSN, PINs, CVVs) and extracts exact bounding coordinates.
   - **Offscreen Canvas Redaction**: Dedicated offscreen document applies blackout masks over DOM PII boxes and detected faces via a WebGPU ML placeholder (`detectVisualPII`).

3. ⚡ **Zero Corporate Models / Self-Hosted Backend**:
   - **On-Device ViT**: In-browser local reasoning for instantaneous actions without outbound network requests.
   - **Custom Model Backend**: Flexible client for your self-hosted FastAPI / vLLM / private model cluster with live health/ping checking.

4. 💻 **Full-Featured User Interfaces**:
   - **Side Panel Agent Workspace** (`Ctrl + Shift + E`): Interactive chat stream, live Set-of-Mark node counter, action plan timeline with run/skip controls, and privacy indicators.
   - **Action Popup**: Fast prompt launcher with quick preset chips, live active tab node count, privacy shield toggle, and open agent workspace button.
   - **Full-Page Settings Dashboard** (`options.html`): Backend server URL configuration, Bearer authentication token, live connection testing, master privacy redactions, custom regex blacklist rules, and automation safeguards.

---

## 📂 Project Structure

```
├── manifest.json              # Chrome Extension Manifest V3 definition
├── vite.config.ts             # Vite + CRXJS + React bundler config
├── tailwind.config.js         # Tailwind CSS styling configuration
│
├── background.js              # Service Worker orchestrating the 7-step agent loop
├── offscreen.html & .js       # Offscreen document: Canvas blackout redaction & WebGPU ML placeholder
├── content.js & content.css   # Content script: Set-of-Mark ID overlays, PII detection & action execution
├── popup.html                 # Toolbar popup HTML entry point (mounts React popup)
├── sidepanel.html             # HTML entry point for the Side Panel agent workspace
├── options.html               # HTML entry point for the Full-Page Settings dashboard
│
├── icons/                     # Extension icon assets (16, 32, 48, 128 PNGs)
├── scripts/
│   └── generate-icons.js      # Script to generate crisp PNG icon assets
│
└── src/                       # React + TypeScript Core Application
    ├── ai/                    # Custom backend client, router, on-device ViT & turn coordinator
    ├── components/            # Reusable UI library (Button, Card, Toggle, Badge, Header)
    ├── content/               # Modular DOM extractor, action executor, and highlighter
    ├── privacy/               # Canvas redactor, DOM sanitizer, and text PII scrubber
    ├── sidepanel/             # Side Panel React workspace
    ├── popup/                 # Popup React component
    ├── options/               # Settings Page React component
    ├── types/                 # TypeScript interfaces and messaging contracts
    └── utils/                 # Chrome Storage & type-safe messaging utilities
```

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
bun install
```

### 2. Development Mode (with Live Hot-Reloading)
```bash
bun run dev
```

### 3. Production Build
```bash
bun run build
```
This bundles the optimized extension into the `dist/` directory.

---

## 🌐 Loading into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select:
   `/home/duck/projects/sihext/dist`
4. Click the extension icon in your toolbar or press **`Ctrl + Shift + E`** (or **`Cmd + Shift + E`** on Mac) to open the Side Panel.
5. Open **Options** to configure your backend endpoint URL and run the live connection test.
