# dsh-silly-sta

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/dsh-0.2.0--rc.2+-orange.svg)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![node](https://img.shields.io/badge/node->=22.19.0-green.svg)](https://nodejs.org/)
[![github](https://img.shields.io/badge/GitHub-Yalis0910%2Fdsh--silly--sta-181717?logo=github)](https://github.com/Yalis0910/dsh-silly-sta)

English | [简体中文](README.md)

An immersive role-play and character authoring plugin for DeepSeek Harness (DSH). Brings SillyTavern-compatible character cards, interactive creation forge, local gallery management, and a modern, Yohaku-inspired minimalist UI experience to DSH.

---

## Preview

| Character Selection Grid | Immersive Chat & Greeting Switcher | Inline Instruction Drawer |
| :---: | :---: | :---: |
| ![Character Selection](images/1.png) | ![Chat Interface](images/2.png) | ![Inline Drawer](images/3.png) |

---

## ✨ Features

### 🎭 Immersive Role-play
- **SillyTavern Standard Compatibility**: Full support for standard V2/V3 character cards, embedded PNG metadata (tEXt/iTXt), and JSON export/import.
- **Yohaku Aesthetics & Natural Text Flow**: Inspired by Yohaku's minimalist design philosophy. Eliminates bulky speech bubbles in favor of a clean, borderless, continuous prose stream with responsive layouts optimized for both desktop and mobile devices.
- **Intelligent Prose Coloring**: Distinguishes spoken dialogue, narration, thoughts, and actions. Dynamically executes character-specific regex scripts with subtle, elegant color highlights.
- **Alternate Greetings Switcher**: Effortlessly cycle through multiple opening greetings using inline pagination controls without needing to re-create the session.
- **Inline Temporary Instruction (OOC Tray)**: An unobtrusive drawer to guide the narrative or make out-of-character adjustments. Injected into the subsequent turn and automatically cleared after submission.
- **Scene Setting (Author's Note)**: Configurable story guidance and tone setting injected deeply into context for long-term narrative consistency.
- **Interactive Choice Mode**: Option to prompt the model for branching narrative actions that can be chosen with a single click.

### 🛠️ Character Forge (Interactive Creation)
- **One-Line Inspiration**: Transform a single prompt into a fully formed character card featuring backstory, personality, opening greeting, scenario, lorebook entries, and avatar.
- **Full-Featured Card Editor**: Edit card details, tags, system prompts, alternate greetings, and regex scripts, alongside rich Lorebook management.
- **Export Anywhere**: Export cards directly as standard SillyTavern-compatible PNGs (with embedded metadata) or JSON files.

### 🖼️ Local Gallery & Illustration Viewer
- **Built-in Gallery Management**: Inspect saved character portraits and illustrations under **Settings → 角色扮演 (Role-play) → 图库 (Gallery)** with disk usage statistics, favorites, batch migration, and deletion.
- **Full-Screen Lightbox**: View illustrations and character avatars at original resolution with the integrated click-to-zoom lightbox.
- **Toolview Slot Integration**: Adapts `tool.call.toolview` to render image generation cards elegantly in chat and bind generated images directly as character avatars.

### 🗄️ Two-Tier Storage & Context Compaction
- **Scope Isolation**: Seamlessly isolate assets between Global storage and Workspace storage with easy migration tools.
- **Automatic Context Compaction**: Fully compliant with DSH 0.2.x compaction architecture, preventing context overflow during extended story arcs.

---

## 📦 Requirements

- **[dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)**: **`0.2.0-rc.2+`**
- **Node.js**: **`>=22.19.0`**
- **pnpm**: **`>=9.0.0`**

---

## 🚀 Installation

### Option 1: From GitHub (Recommended)

Install directly via the DSH plugin manager:

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta
```

To specify a particular branch or tag:

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta#main
```

> **Note**: Installing via GitHub automatically triggers the `prepare` script to build client and agent bundles. If pnpm warns that build scripts were ignored, add the package to the allowlist in `~/.dsh/profiles/web/pnpm-workspace.yaml`:
> ```yaml
> allowBuilds:
>   silly-sta: true
> ```

---

### Option 2: Local Clone & Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/Yalis0910/dsh-silly-sta.git
cd dsh-silly-sta
pnpm install
```

Run comprehensive checks and builds:

```bash
npm run check
```

Link the local directory into the DSH Web Profile:

```bash
dsh plugin --profile web add -w .
```

Start DSH Web for live development and testing:

```bash
dsh web
```

---

## 🔄 Updates & Uninstallation

### Updating

For GitHub installs, rerun the add command to pull the latest commits:

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta
```

For local development checkouts, pull via `git pull`, run `npm run check`, and restart `dsh web`.

### Uninstallation

```bash
dsh plugin --profile web remove silly-sta
```

> **Note**: Stored character cards and image files remain safely preserved in `$DSH_HOME/roleplay/` and can be manually removed if desired.

---

## 💻 Build Commands

The project uses TypeScript and esbuild. On Windows PowerShell if execution policies prevent script execution, run the commands directly with Node:

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.client.json --noEmit
node scripts/build.mjs
node scripts/verify-dsh-imports.mjs
```

---

## 📖 Quick Start Guide

1. **Activate Role-play Preset**:
   - Launch `dsh web` and switch to the **"角色扮演 · Role-play"** agent preset in the top dropdown (or when creating a new session).
2. **Select or Import Cards**:
   - The character dock will appear above the composer. Click any card to bind it and begin your chat.
   - Go to **Settings → 角色扮演 (Role-play)** to import SillyTavern PNG character cards or JSON presets.
3. **Customize Opening & Instructions**:
   - Click **"临时指令" (Temporary Instruction)** on the dock to expand the inline guidance panel.
   - Use the **"‹ / ›"** buttons on the opening card to browse and switch alternate greetings.

---

## 🤝 Credits & Acknowledgments

- Thanks to the [SillyTavern](https://github.com/SillyTavern/SillyTavern) community for establishing the open character card and lorebook standards.
- Thanks to [RP-Hub](https://github.com/STA1N156/RP-Hub) for character card ideas and prompt patterns.
- UI/UX design inspired by the [Yohaku (余白)](https://yohaku.innei.dev/) minimalist design philosophy.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
