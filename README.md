# AetherDOM AI — Privacy-First Hybrid Vision & DOM Agent

A modern Chrome Extension (Manifest V3) built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **CRXJS**. It features an intelligent dual-engine architecture:
1. **On-Device ViT Engine**: Fast in-browser local vision & DOM understanding (zero data leaves device).
2. **Cloud Multimodal AI (Gemini / OpenAI / Anthropic / Local Ollama)**: High-capacity reasoning for complex tasks with automated pre-flight **PII, Password, & Face Redaction**.

---

## 🚀 Key Features

- 🛡️ **Privacy-First Redaction Shield**:
  - **DOM Masking**: Password fields (`type="password"`), credit card numbers (Luhn/regex), emails, phone numbers, and auth tokens are scrubbed before reaching AI models.
  - **Visual Screenshot Redactor**: Canvas-based pixelation / blackout masking over sensitive inputs and detected faces.
  - **Custom Regex Blacklist**: User-defined regex rules to redact internal proprietary IDs or confidential patterns.

- ⚡ **Hybrid Intelligent Routing**:
  - **Auto**: Automatically runs sensitive forms or quick DOM navigations on-device, and routes multi-step reasoning to cloud.
  - **On-Device Strict**: 100% offline, zero-cloud mode.
  - **Cloud-Preferred**: Routes to Gemini 1.5 Flash/Pro, GPT-4o, or Claude 3.5 Sonnet with automated PII stripping.

- 🤖 **DOM Automation & Action Engine**:
  - Automatically identifies interactive nodes (`data-sihext-ref="1"`).
  - Performs safe synthetic actions: `click`, `type`, `scroll`, `select`, `submit`, `hover`, and `navigate`.
  - Step-by-step visual element highlighting on the active webpage.

- 💻 **Modern UI & Extensions API**:
  - **Side Panel Agent Workspace**: Persistent chat, live DOM node counts, action timeline with run/skip controls.
  - **Action Popup**: Quick page summary, node scan, and privacy shield toggle.
  - **Options Page**: API key management, custom regex rules, routing policies, and automation delay timers.

---

## 🛠️ Project Structure

```
├── manifest.json              # Chrome Extension Manifest V3 definition
├── vite.config.ts             # Vite + CRXJS + React configuration
├── tailwind.config.js         # Tailwind CSS styling configuration
├── popup.html                 # Toolbar popover HTML entry
├── sidepanel.html             # Chrome Side Panel HTML entry
├── options.html               # Options/Settings page HTML entry
├── offscreen.html             # Offscreen canvas document for image redactions
├── scripts/
│   └── generate-icons.js      # Script to generate extension icon assets
└── src/
    ├── background/            # Manifest V3 Background Service Worker
    ├── content/               # Webpage Content Script (DOM Extractor, Action Executor, Highlighter)
    ├── privacy/               # Redaction Engine (Text PII Scrubber, DOM Sanitizer, Canvas Redactor)
    ├── ai/                    # Hybrid AI Layer
    │   ├── router.ts          # Intelligent Router (On-Device vs Cloud)
    │   ├── ondevice/          # On-Device ViT & local reasoning engine
    │   └── cloud/             # Gemini, OpenAI, and Anthropic API clients
    ├── sidepanel/             # Side Panel React App
    ├── popup/                 # Toolbar Popup React App
    ├── options/               # Settings Page React App
    ├── components/            # Reusable UI Components (Button, Toggle, Badge, Card, Header)
    ├── types/                 # TypeScript interfaces and messaging contracts
    └── utils/                 # Chrome Storage & Messaging helpers
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
This generates the bundled, optimized extension in the `dist/` directory.

---

## 🌐 Loading the Extension into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` directory inside this project folder:
   `/home/duck/projects/sihext/dist`
5. The extension **AetherDOM AI** will now appear in your browser toolbar!

---

## ⌨️ Shortcuts & Usage

- **Toggle Side Panel**: `Ctrl + Shift + E` (or `Command + Shift + E` on macOS)
- **Click the Extension Icon** in the toolbar to see the quick action popover.
- **Right-click Extension Icon > Options** to configure your API keys (Google Gemini, OpenAI, Claude, or custom Ollama URL) and customize privacy redaction filters.
