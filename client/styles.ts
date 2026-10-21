/** Component CSS, injected once as a tagged <style> element.
 *
 * Designed in the Yohaku (余白) aesthetic style (https://yohaku.innei.dev/):
 *  - "一抹 accent，三档 neutral，余者尽留为白"
 *  - Literary, serene paper-like surfaces, hairline borders, refined typography (Serif/Sans/Mono)
 *  - Akane/Plum accent (#c56473 / #d47685)
 *  - Full PC and Mobile (MOB) responsive compatibility & touch-friendly ergonomics.
 */

export const CSS_TAG = 'silly-sta/client'

export const CSS = `
/* ── Yohaku Design Tokens ───────────────────────────────────────────── */
:root {
  --yh-font-sans: var(--app-font-sans, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, "Noto Sans SC", sans-serif);
  --yh-font-serif: var(--app-font-serif, "Noto Serif SC", "Source Han Serif SC", "SongTi SC", "SimSun", "STSong", serif);
  --yh-font-mono: var(--app-font-mono, "OperatorMonoSSmLig Nerd Font", "Cascadia Code PL", JetBrainsMono, "Fira Code", Consolas, Menlo, monospace);

  /* Light Theme (Rice-paper & Japanese Plum) */
  --yh-paper: #faf9f5;
  --yh-paper-subtle: #f4f2eb;
  --yh-neutral-1: #f9f8f5;
  --yh-neutral-2: #f0efeb;
  --yh-neutral-3: #e3e1db;
  --yh-neutral-4: #d0cec6;
  --yh-neutral-5: #a8a69f;
  --yh-neutral-6: #787670;
  --yh-neutral-7: #5c5a55;
  --yh-neutral-8: #403f3a;
  --yh-neutral-9: #24231f;
  --yh-neutral-10: #141312;

  --yh-accent: #c56473;
  --yh-accent-soft: rgba(197, 100, 115, 0.08);
  --yh-accent-medium: rgba(197, 100, 115, 0.16);
  --yh-accent-line: rgba(197, 100, 115, 0.28);
  --yh-accent-tint: rgba(197, 100, 115, 0.03);

  --yh-border: rgba(24, 24, 27, 0.09);
  --yh-border-subtle: rgba(24, 24, 27, 0.05);
  --yh-border-strong: rgba(24, 24, 27, 0.18);

  --yh-field-bg: #faf9f5;
  --yh-field-border: rgba(0, 0, 0, 0.08);
  --yh-field-shadow: 0 1px 2px rgba(0, 0, 0, 0.02), 0 3px 10px rgba(0, 0, 0, 0.03);
  --yh-field-gradient: linear-gradient(180deg, rgba(197, 100, 115, 0.03) 0%, transparent 26%);

  --yh-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 16px rgba(0, 0, 0, 0.03);
  --yh-shadow-card-hover: 0 4px 14px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(197, 100, 115, 0.04);
  --yh-shadow-popover: 0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);

  --yh-info: #4a7bb0;
  --yh-success: #5e9f7e;
  --yh-warning: #a87a3d;
  --yh-error: #a64953;
}

[data-theme="dark"], [data-ds-dark-theme="true"], body[data-ds-dark-theme] {
  /* Dark Theme (Sumi Ink Paper) */
  --yh-paper: #18181a;
  --yh-paper-subtle: #202023;
  --yh-neutral-1: #141312;
  --yh-neutral-2: #24231f;
  --yh-neutral-3: #403f3a;
  --yh-neutral-4: #5c5a55;
  --yh-neutral-5: #787670;
  --yh-neutral-6: #a8a69f;
  --yh-neutral-7: #d0cec6;
  --yh-neutral-8: #e3e1db;
  --yh-neutral-9: #f0efeb;
  --yh-neutral-10: #f9f8f5;

  --yh-accent: #d47685;
  --yh-accent-soft: rgba(212, 118, 133, 0.12);
  --yh-accent-medium: rgba(212, 118, 133, 0.22);
  --yh-accent-line: rgba(212, 118, 133, 0.35);
  --yh-accent-tint: rgba(212, 118, 133, 0.06);

  --yh-border: rgba(255, 255, 255, 0.09);
  --yh-border-subtle: rgba(255, 255, 255, 0.05);
  --yh-border-strong: rgba(255, 255, 255, 0.18);

  --yh-field-bg: #222225;
  --yh-field-border: rgba(255, 255, 255, 0.09);
  --yh-field-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.25);
  --yh-field-gradient: linear-gradient(180deg, rgba(212, 118, 133, 0.06) 0%, transparent 26%);

  --yh-shadow-card: 0 2px 12px rgba(0, 0, 0, 0.35);
  --yh-shadow-card-hover: 0 6px 22px rgba(0, 0, 0, 0.45);
  --yh-shadow-popover: 0 10px 32px rgba(0, 0, 0, 0.55);

  --yh-info: #7090b3;
  --yh-success: #8cbea3;
  --yh-warning: #c8a06b;
  --yh-error: #c8767f;
}

/* ── The Roleplay Dock ──────────────────────────────────────────────── */
.rp-dock {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--yh-paper);
  background-image: linear-gradient(180deg, var(--yh-accent-tint) 0%, transparent 35%);
  border: 1px solid var(--yh-border);
  box-shadow: var(--yh-shadow-card);
  font-family: var(--yh-font-sans);
  font-size: 13px;
  color: var(--yh-neutral-9);
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-side-clearance, 16px) * 2);
  max-width: var(--dsh-composer-card-max-width, 780px);
  margin: 0 auto;
  flex: none;
  position: relative;
  overflow: visible;
  z-index: 10;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Yohaku delicate top accent line */
.rp-dock::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 14px;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, var(--yh-accent-line) 20%, var(--yh-accent-line) 80%, transparent);
  pointer-events: none;
}

.rp-dock-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rp-dock-row-oneline {
  flex-wrap: nowrap;
  min-width: 0;
}
.rp-dock-row-oneline > * {
  flex: none;
}
.rp-dock-row-oneline .rp-spacer {
  flex: 1 1 0;
}
.rp-dock-row-oneline .rp-name {
  flex: 0 1 auto;
  min-width: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-dock-secondary-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.rp-dock-more-wrap,
.rp-popover.rp-dock-more-wrap,
.rp-btn.rp-dock-more-btn {
  display: none !important;
  position: relative;
}

.rp-btn.rp-dock-more-btn {
  font-weight: bold;
  letter-spacing: 1px;
}

.rp-more-tray.rp-more-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  left: auto;
  z-index: 1000;
  width: 175px;
  min-width: 160px;
  padding: 6px;
  gap: 2px;
  border-radius: 12px;
  background: var(--yh-paper);
  border: 1px solid var(--yh-border-strong);
  box-shadow: var(--yh-shadow-popover);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: rp-popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.rp-more-grid.rp-more-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 0;
}

.rp-more-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--yh-neutral-8);
  font-size: 12px;
  font-family: var(--yh-font-sans);
  cursor: pointer;
  text-align: left;
  user-select: none;
  transition: all 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}

.rp-more-menu-item:hover {
  background: var(--yh-accent-soft);
  color: var(--yh-accent);
}

.rp-more-menu-item.rp-on {
  color: var(--yh-accent);
  font-weight: 500;
}

/* ── Unified Story & Director Studio Tray Tabs ── */
.rp-studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.rp-studio-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--yh-neutral-2);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--yh-border);
  flex-wrap: wrap;
}

.rp-studio-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--yh-neutral-8);
  cursor: pointer;
  transition: all 0.15s ease;
}

.rp-studio-tab:hover {
  background: var(--yh-neutral-3);
  color: var(--yh-neutral-10);
}

.rp-studio-tab.rp-active {
  background: var(--yh-paper);
  color: var(--yh-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.rp-tab-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--yh-accent);
}

.rp-btn-diet-on {
  background: rgba(34, 197, 94, 0.15) !important;
  color: #16a34a !important;
  border: 1px solid rgba(34, 197, 94, 0.4) !important;
  font-weight: 600;
}

.rp-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  background: var(--yh-neutral-2);
  border: 1px solid var(--yh-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.rp-avatar:hover {
  transform: scale(1.05);
}

.rp-avatar-fallback {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--yh-accent-soft);
  color: var(--yh-accent);
  border: 1px solid var(--yh-accent-line);
  font-family: var(--yh-font-serif);
  font-size: 15px;
  font-weight: 600;
}

.rp-name {
  font-family: var(--yh-font-serif);
  font-weight: 500;
  font-size: 14.5px;
  letter-spacing: 0.01em;
  color: var(--yh-neutral-10);
}

.rp-muted {
  color: var(--yh-neutral-6);
  font-size: 12px;
}

.rp-spacer {
  flex: 1;
}

/* ── Yohaku Buttons ─────────────────────────────────────────────────── */
.rp-btn {
  cursor: pointer;
  user-select: none;
  border: 1px solid var(--yh-border);
  background: var(--yh-neutral-1);
  color: var(--yh-neutral-8);
  border-radius: 10px;
  padding: 5px 12px;
  font-size: 12px;
  line-height: 18px;
  font-family: var(--yh-font-sans);
  font-weight: 500;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.rp-btn:hover {
  background: var(--yh-neutral-2);
  border-color: var(--yh-border-strong);
  color: var(--yh-neutral-10);
}

.rp-btn:active {
  transform: translateY(1px);
}

.rp-btn.rp-on {
  background: var(--yh-accent-soft);
  border-color: var(--yh-accent-line);
  color: var(--yh-accent);
  font-weight: 500;
}

.rp-btn.rp-on:hover {
  background: var(--yh-accent-medium);
  border-color: var(--yh-accent);
}

.rp-btn.rp-active {
  background: var(--yh-neutral-3);
  border-color: var(--yh-border-strong);
  color: var(--yh-neutral-10);
}

.rp-btn:disabled {
  opacity: 0.45;
  cursor: default;
  transform: none;
}

.rp-btn-primary {
  background: var(--yh-accent-soft);
  border-color: var(--yh-accent-line);
  color: var(--yh-accent);
  font-weight: 500;
}
.rp-btn-primary:hover:not(:disabled) {
  background: var(--yh-accent-medium);
  border-color: var(--yh-accent);
  color: var(--yh-accent);
}

.rp-btn-danger {
  color: var(--yh-error);
  border-color: rgba(166, 73, 83, 0.28);
  background: rgba(166, 73, 83, 0.06);
}
.rp-btn-danger:hover:not(:disabled) {
  border-color: var(--yh-error);
  background: rgba(166, 73, 83, 0.14);
}

.rp-btn-blue {
  color: var(--yh-info);
  border-color: rgba(74, 123, 176, 0.28);
  background: rgba(74, 123, 176, 0.05);
}
.rp-btn-blue:hover:not(:disabled) {
  border-color: var(--yh-info);
  background: rgba(74, 123, 176, 0.12);
}

.rp-btn-green {
  color: var(--yh-success);
  border-color: rgba(94, 159, 126, 0.28);
  background: rgba(94, 159, 126, 0.05);
}
.rp-btn-green:hover:not(:disabled) {
  border-color: var(--yh-success);
  background: rgba(94, 159, 126, 0.12);
}

/* ── Scope Chips (Yohaku Pill Tags) ─────────────────────────────────── */
.rp-scope-tag {
  font-family: var(--yh-font-mono);
  font-size: 10px;
  line-height: 15px;
  letter-spacing: 0.04em;
  border-radius: 999px;
  padding: 1px 7px;
  margin-right: 6px;
  vertical-align: 1px;
  font-weight: 500;
  white-space: nowrap;
  display: inline-block;
}
.rp-scope-global {
  color: var(--yh-info);
  background: rgba(74, 123, 176, 0.08);
  border: 1px solid rgba(74, 123, 176, 0.24);
}
.rp-scope-workspace {
  color: var(--yh-success);
  background: rgba(94, 159, 126, 0.08);
  border: 1px solid rgba(94, 159, 126, 0.24);
}

.rp-star {
  background: none;
  border: none;
  padding: 0 4px 0 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--yh-accent);
  transition: transform 0.18s ease;
}
.rp-star:hover {
  transform: scale(1.2);
}

/* ── Card Library & Selection Grid ─────────────────────────────────── */
.rp-cardgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  max-height: 290px;
  overflow-y: auto;
  padding: 4px 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--yh-neutral-4) transparent;
}

.rp-cardcell {
  cursor: pointer;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 11px;
  border-radius: 12px;
  border: 1px solid var(--yh-border);
  background: var(--yh-paper);
  background-image: linear-gradient(180deg, var(--yh-accent-tint) 0%, transparent 40%);
  text-align: left;
  font-family: inherit;
  color: var(--yh-neutral-9);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.rp-cardcell:hover:not(:disabled) {
  border-color: var(--yh-accent-line);
  background: var(--yh-neutral-2);
  transform: translateY(-1.5px);
  box-shadow: var(--yh-shadow-card-hover);
}
.rp-cardcell .rp-cardname, .rp-cardcell .rp-cardnote {
  display: block;
  position: relative;
  z-index: 1;
}
.rp-cardcell-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.rp-cardcell .rp-cardname {
  font-family: var(--yh-font-serif);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--yh-neutral-10);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-cardcell .rp-cardnote {
  font-size: 11px;
  color: var(--yh-neutral-6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

/* ── Inline Greeting Preview ────────────────────────────────────────── */
.rp-greeting {
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: var(--yh-font-serif);
  font-size: 12.5px;
  line-height: 20px;
  color: var(--yh-neutral-7);
  border-left: 2px solid var(--yh-accent-line);
  padding: 3px 0 3px 12px;
  margin-top: 4px;
}

/* ── Inline Trays & Popovers ────────────────────────────────────────── */
.rp-tray-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 6px;
  border-radius: 12px;
  background: var(--yh-paper);
  background-image: var(--yh-field-gradient);
  border: 1px solid var(--yh-border-strong);
  box-shadow: var(--yh-field-shadow);
  animation: rp-tray-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes rp-tray-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.rp-tray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--yh-border-subtle);
}
.rp-tray-title {
  font-family: var(--yh-font-serif);
  font-size: 13px;
  font-weight: 500;
  color: var(--yh-neutral-10);
}
.rp-tray-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Instruction Preset Chips ─────────────────────────────────────── */
.rp-chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.rp-chip {
  cursor: pointer;
  user-select: none;
  font-family: var(--yh-font-sans);
  font-size: 11px;
  line-height: 16px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--yh-border-subtle);
  background: var(--yh-paper-2);
  color: var(--yh-neutral-8);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.rp-chip:hover {
  background: var(--yh-accent-soft);
  border-color: var(--yh-accent-line);
  color: var(--yh-accent);
}
.rp-chip:active {
  transform: translateY(1px);
}

/* ── Persona Switcher in Dock ─────────────────────────────────────── */
.rp-persona-select {
  font-family: var(--yh-font-sans);
  font-size: 12px;
  line-height: 18px;
  padding: 4px 8px;
  border-radius: 9px;
  border: 1px solid var(--yh-border);
  background: var(--yh-paper);
  color: var(--yh-neutral-9);
  cursor: pointer;
  outline: none;
  max-width: 140px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
.rp-persona-select:hover {
  background: var(--yh-neutral-2);
  border-color: var(--yh-border-strong);
  color: var(--yh-neutral-10);
}
.rp-persona-select:focus {
  border-color: var(--yh-accent);
}

/* ── User Persona Library in Settings ─────────────────────────────── */
.rp-persona-manager {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.rp-persona-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rp-persona-card {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--yh-border);
  background: var(--yh-paper);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.18s ease;
}
.rp-persona-card:hover {
  border-color: var(--yh-border-strong);
  background: var(--yh-neutral-1);
}
.rp-persona-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rp-persona-card-name {
  font-family: var(--yh-font-serif);
  font-weight: 600;
  font-size: 13.5px;
  color: var(--yh-neutral-10);
}
.rp-persona-card-desc {
  font-size: 12px;
  color: var(--yh-neutral-7);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.rp-persona-editbox {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--yh-accent-line);
  background: var(--yh-paper);
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.rp-popover {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.rp-popover-panel {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  left: auto;
  z-index: 1000;
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: 12px;
  border-radius: 12px;
  background: var(--yh-paper);
  background-image: var(--yh-field-gradient);
  border: 1px solid var(--yh-border-strong);
  box-shadow: var(--yh-shadow-popover);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: rp-popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes rp-popover-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.rp-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--yh-border-subtle);
}
.rp-popover-title {
  font-family: var(--yh-font-serif);
  font-size: 13px;
  font-weight: 500;
  color: var(--yh-neutral-10);
}
.rp-popover-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rp-popover-close {
  background: transparent;
  border: none;
  color: var(--yh-neutral-5);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.rp-popover-close:hover {
  color: var(--yh-accent);
  background: var(--yh-accent-soft);
}
.rp-btn-subtle {
  padding: 2px 7px;
  font-size: 11px;
  background: transparent;
  border: 1px solid var(--yh-border-subtle);
  border-radius: 6px;
  color: var(--yh-neutral-6);
  cursor: pointer;
  transition: all 0.15s ease;
}
.rp-btn-subtle:hover {
  color: var(--yh-accent);
  border-color: var(--yh-accent-line);
}

.rp-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 64px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid var(--yh-field-border);
  background: var(--yh-field-bg);
  box-shadow: var(--yh-field-shadow);
  color: var(--yh-neutral-9);
  padding: 8px 10px;
  font-family: var(--yh-font-sans);
  font-size: 12.5px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.rp-textarea:focus {
  border-color: var(--yh-accent);
  box-shadow: 0 0 0 3px var(--yh-accent-soft);
}

/* ── Inline Illustrations ───────────────────────────────────────────── */
.rp-imggrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
}
.rp-imggrid img {
  max-width: 280px;
  max-height: 340px;
  border-radius: 12px;
  border: 1px solid var(--yh-border);
  box-shadow: var(--yh-shadow-card);
  cursor: zoom-in;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.rp-imggrid img:hover {
  transform: translateY(-1px);
  box-shadow: var(--yh-shadow-card-hover);
}

/* ── Lightbox ───────────────────────────────────────────────────────── */
.rp-lightbox {
  z-index: 1000;
  place-items: center;
  padding: 40px;
  display: grid;
  position: fixed;
  inset: 0;
}
.rp-lightbox-mask {
  background: rgba(18, 18, 20, 0.72);
  backdrop-filter: blur(16px);
  position: absolute;
  inset: 0;
}
.rp-lightbox-img {
  object-fit: contain;
  background: var(--yh-paper);
  max-width: min(100%, 1600px);
  max-height: calc(100vh - 80px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border-radius: 14px;
  border: 1px solid var(--yh-border);
  position: relative;
}
.rp-lightbox-close {
  z-index: 1;
  border: 1px solid var(--yh-border-strong);
  background: var(--yh-paper);
  width: 38px;
  height: 38px;
  color: var(--yh-neutral-9);
  cursor: pointer;
  border-radius: 999px;
  place-items: center;
  display: grid;
  position: fixed;
  top: 20px;
  right: 20px;
  box-shadow: var(--yh-shadow-popover);
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.rp-lightbox-close:hover {
  transform: scale(1.08);
  border-color: var(--yh-accent);
  color: var(--yh-accent);
}

/* ── Tool Cards & Results ───────────────────────────────────────────── */
.rp-toolcard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--yh-paper);
  background-image: var(--yh-field-gradient);
  border: 1px solid var(--yh-border);
  box-shadow: var(--yh-shadow-card);
}
.rp-toolcard-title {
  font-family: var(--yh-font-mono);
  font-size: 11.5px;
  letter-spacing: 0.03em;
  color: var(--yh-neutral-6);
}
.rp-toolcard-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}
.rp-savedcard {
  display: flex;
  gap: 12px;
  align-items: center;
}
.rp-savedcard img {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid var(--yh-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.rp-forge-result {
  max-width: 720px;
}

/* ── Settings Section & Forms ───────────────────────────────────────── */
.rp-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-size: 13px;
  color: var(--yh-neutral-9);
  padding-top: 6px;
  max-width: 800px;
}
.rp-settings h3 {
  margin: 0 0 4px;
  font-family: var(--yh-font-serif);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--yh-neutral-10);
}
.rp-settings h4 {
  margin: 14px 0 4px;
  font-family: var(--yh-font-serif);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--yh-neutral-7);
}

.rp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 6px 0;
}
.rp-field label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--yh-neutral-7);
}

.rp-field input, .rp-field select, .rp-field textarea {
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid var(--yh-field-border);
  background: var(--yh-field-bg);
  background-image: var(--yh-field-gradient);
  box-shadow: var(--yh-field-shadow);
  color: var(--yh-neutral-9);
  padding: 8px 12px;
  font-family: var(--yh-font-sans);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.rp-field input:focus, .rp-field select:focus, .rp-field textarea:focus {
  border-color: var(--yh-accent);
  box-shadow: 0 0 0 3px var(--yh-accent-soft);
}
.rp-field textarea {
  min-height: 70px;
  resize: vertical;
}

.rp-inline {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.rp-inline .rp-field {
  flex: 1;
  min-width: 140px;
}

.rp-select {
  cursor: pointer;
  border: 1px solid var(--yh-border);
  background: var(--yh-neutral-1);
  color: var(--yh-neutral-9);
  border-radius: 10px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  font-family: var(--yh-font-sans);
  outline: none;
  transition: all 0.2s ease;
}
.rp-select:hover {
  background: var(--yh-neutral-2);
  border-color: var(--yh-border-strong);
}

/* ── Switches (Yohaku Pill Switch) ─────────────────────────────────── */
.rp-risk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border-subtle);
}
.rp-risk-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--yh-neutral-9);
}
.rp-risk-help {
  display: inline-flex;
  align-items: center;
  color: var(--yh-neutral-5);
  cursor: help;
  outline: none;
}
.rp-risk-help:hover, .rp-risk-help:focus-visible {
  color: var(--yh-accent);
}

.rp-switch {
  position: relative;
  flex: none;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--yh-border);
  background: var(--yh-neutral-3);
  cursor: pointer;
  padding: 0;
  transition: background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease;
}
.rp-switch .rp-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: left 0.2s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s ease;
}
.rp-switch.rp-on {
  background: var(--yh-accent);
  border-color: var(--yh-accent);
}
.rp-switch.rp-on .rp-switch-knob {
  left: 18px;
}

/* ── Card Manager, Search & Filters ─────────────────────────────────── */
.rp-cardmanager-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.rp-cardmanager-head h4 {
  margin: 0;
}
.rp-card-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0 14px;
}
.rp-search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.rp-card-search {
  width: 100%;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid var(--yh-field-border);
  background: var(--yh-field-bg);
  background-image: var(--yh-field-gradient);
  color: var(--yh-neutral-9);
  padding: 7px 28px 7px 12px;
  font-family: var(--yh-font-sans);
  font-size: 12.5px;
  outline: none;
  transition: all 0.2s ease;
}
.rp-card-search:focus {
  border-color: var(--yh-accent);
  box-shadow: 0 0 0 3px var(--yh-accent-soft);
}
.rp-search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--yh-neutral-5);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  line-height: 1;
}
.rp-search-clear:hover {
  color: var(--yh-neutral-9);
}

.rp-filter-pills {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--yh-neutral-1);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--yh-border-subtle);
}
.rp-filter-pill {
  border: none;
  background: transparent;
  color: var(--yh-neutral-7);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
}
.rp-filter-pill:hover {
  color: var(--yh-neutral-10);
}
.rp-filter-pill.rp-active {
  background: var(--yh-paper);
  color: var(--yh-accent);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.rp-pill-count {
  font-family: var(--yh-font-mono);
  font-size: 10px;
  opacity: 0.7;
}

/* ── Card Rows & Clamped Preview (prevents infinite vertical stretching) ── */
.rp-cardlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rp-cardrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--yh-border);
  background: var(--yh-paper);
  box-shadow: var(--yh-shadow-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: 0;
}
.rp-cardrow:hover {
  border-color: var(--yh-border-strong);
  box-shadow: var(--yh-shadow-card-hover);
}
.rp-cardrow-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  flex: none;
  border: 1px solid var(--yh-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  background: var(--yh-neutral-2);
}
.rp-cardrow-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
  flex: 1;
}
.rp-cardrow-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.rp-star {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #f59e0b;
  font-size: 15px;
  line-height: 1;
  padding: 0 2px;
  transition: transform 0.15s ease;
  flex: none;
}
.rp-star:hover {
  transform: scale(1.2);
}
.rp-scope-tag {
  font-family: var(--yh-font-mono);
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  line-height: 14px;
  flex: none;
}
.rp-scope-global {
  background: rgba(94, 159, 126, 0.12);
  color: var(--yh-success);
  border-color: rgba(94, 159, 126, 0.25);
}
.rp-scope-workspace {
  background: rgba(74, 123, 176, 0.12);
  color: var(--yh-info);
  border-color: rgba(74, 123, 176, 0.25);
}
.rp-cardrow-name {
  font-family: var(--yh-font-serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--yh-neutral-10);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.rp-lore-badge {
  font-family: var(--yh-font-mono);
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--yh-accent-soft);
  color: var(--yh-accent);
  border: 1px solid var(--yh-accent-line);
  line-height: 14px;
  white-space: nowrap;
  flex: none;
}

/* Clamped description: max 2 lines with ellipsis to stop vertical explosion */
.rp-cardrow-desc {
  font-family: var(--yh-font-sans);
  font-size: 12px;
  line-height: 17px;
  color: var(--yh-neutral-6);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 34px;
  word-break: break-word;
  white-space: normal;
}
.rp-cardrow-actions {
  flex: none;
  flex-shrink: 0;
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}
.rp-cardrow-actions .rp-btn {
  padding: 4px 8px;
  font-size: 11.5px;
  line-height: 16px;
  border-radius: 8px;
}
.rp-btn-group {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid var(--yh-border);
  overflow: hidden;
  background: var(--yh-neutral-1);
}
.rp-btn-group .rp-btn {
  border: none;
  border-radius: 0;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 16px;
  font-family: var(--yh-font-mono);
  background: transparent;
  color: var(--yh-neutral-8);
  text-decoration: none;
}
.rp-btn-group .rp-btn:hover {
  background: var(--yh-neutral-2);
  color: var(--yh-neutral-10);
}
.rp-btn-group .rp-btn + .rp-btn {
  border-left: 1px solid var(--yh-border);
}

/* ── Card Editor & Settings Tabs ───────────────────────────────────── */
.rp-editor-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--yh-border);
  margin: 12px 0 16px;
  overflow-x: auto;
}
.rp-settings-tabs {
  margin: 10px 0 18px;
  gap: 6px;
}
.rp-settings-tab-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rp-editor-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--yh-neutral-6);
  font-family: var(--yh-font-serif);
  font-size: 13.5px;
  padding: 6px 14px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.rp-editor-tab:hover {
  color: var(--yh-neutral-9);
}
.rp-editor-tab.rp-active {
  color: var(--yh-accent);
  border-bottom-color: var(--yh-accent);
  font-weight: 500;
}
.rp-editor-tab-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rp-editor-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.rp-note {
  font-size: 12px;
  color: var(--yh-neutral-6);
}
.rp-error {
  font-size: 12px;
  color: var(--yh-error);
}

.rp-editor-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rp-editor-title {
  font-family: var(--yh-font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--yh-neutral-10);
}
.rp-editor-avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0 12px;
}
.rp-editor-avatar {
  width: 68px;
  height: 68px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid var(--yh-border);
  box-shadow: var(--yh-shadow-card);
}

.rp-loreentry {
  border: 1px solid var(--yh-border);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 10px 0;
  background: var(--yh-paper);
  box-shadow: var(--yh-shadow-card);
}
.rp-loreentry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rp-regex-swatch {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1px solid var(--yh-border);
  display: inline-block;
  flex: none;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.rp-regex-swatch input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  padding: 0;
  border: 0;
  cursor: pointer;
}

.rp-ref-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  line-height: 20px;
  cursor: pointer;
  color: var(--yh-neutral-9);
}
.rp-ref-row input {
  accent-color: var(--yh-accent);
}
.rp-ref-preview {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--yh-border);
}
.rp-keyrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rp-keyrow input {
  flex: 1;
  min-width: 0;
}
.rp-points {
  font-family: var(--yh-font-mono);
  font-size: 12px;
  color: var(--yh-neutral-6);
  white-space: nowrap;
}

.rp-ref-thumb {
  padding: 2px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rp-ref-thumb img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  object-fit: cover;
  display: block;
  border: 1px solid var(--yh-border);
}
.rp-ref-thumb-empty {
  font-size: 14px;
  line-height: 1;
  color: var(--yh-neutral-5);
}

/* ── Role-play Chat Flow (Native unboxed stream output, matching Image 2) ── */
body[data-rp-active="1"] [data-chat-flow-kind="assistant-step"] {
  width: 100%;
  max-width: 100%;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-sizing: border-box;
  box-shadow: none;
  font-family: var(--yh-font-sans);
  font-size: 15px;
  line-height: 1.75;
  color: var(--yh-neutral-10);
  letter-spacing: 0.012em;
}

body[data-rp-active="1"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]):not(:has(p)),
body[data-rp-active="1"] [data-chat-flow-kind="assistant-step"][data-turn-process-hidden]:not(:has(p)) {
  width: auto;
  min-width: 0;
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

body[data-rp-active="1"] [data-chat-flow-kind="assistant-step"][data-turn-process-hidden]:has(p) {
  content-visibility: visible;
  margin-top: var(--dsh-chat-flow-gap, 16px);
}

/* Interleaved illustrations */
body[data-rp-active="1"] [data-chat-flow-kind="tool-call"]:has(.rp-genimg),
body[data-rp-active="1"] [data-chat-flow-kind="tool-call"]:has(.rp-genimg) + [data-chat-flow-kind],
body[data-rp-active="1"] [data-chat-flow-kind="tool-call"]:has(.rp-genimg) + [hidden] + [data-chat-flow-kind],
body[data-rp-active="1"] [data-step-process]:has(.rp-genimg),
body[data-rp-active="1"] [data-step-process]:has(.rp-genimg) + [data-chat-flow-kind],
body[data-rp-active="1"] [data-step-process]:has(.rp-genimg) + [hidden] + [data-chat-flow-kind] {
  --dsh-chat-flow-gap: 6px;
}
body[data-rp-active="1"] [data-chat-flow-kind="tool-call"][data-turn-process-hidden]:has(.rp-genimg) {
  margin-top: 6px;
}
body[data-rp-active="1"] .rp-genimg {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 2px 0;
}
body[data-rp-active="1"] .rp-genimg-images > .rp-toolcard-title {
  display: none;
}
body[data-rp-active="1"] .rp-genimg .rp-imggrid {
  padding: 0;
}

[data-chat-flow-kind="tool-call"][data-turn-process-hidden]:has(.rp-genimg, .rp-forge-result) {
  content-visibility: visible;
}
body:not([data-rp-active="1"]) [data-chat-flow-kind="tool-call"][data-turn-process-hidden]:has(.rp-genimg, .rp-forge-result) {
  margin-top: var(--dsh-chat-flow-gap, 16px);
}

[data-step-process][hidden]:has(.rp-genimg, .rp-forge-result) {
  content-visibility: visible;
  margin-top: var(--dsh-chat-flow-gap, 6px);
}
[data-step-process][hidden]:has(.rp-genimg, .rp-forge-result) > :not([data-step-process-body]) {
  display: none;
}
[data-step-process-body][hidden]:has(.rp-genimg, .rp-forge-result) {
  content-visibility: visible;
}
[data-step-process-body][hidden] [data-step-process-content] > :not(:has(.rp-genimg, .rp-forge-result)) {
  display: none;
}
[data-step-process-body]:has(.rp-genimg, .rp-forge-result) {
  max-height: none;
  overflow-y: visible;
  scrollbar-gutter: auto;
}

/* ── Choice Mode Questions ──────────────────────────────────────────── */
.rp-askcard {
  gap: 10px;
}
.rp-askblock {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rp-askquestion {
  font-family: var(--yh-font-serif);
  font-size: 14.5px;
  line-height: 23px;
  color: var(--yh-neutral-10);
  font-weight: 500;
}
.rp-askoptions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rp-askoptions .rp-btn {
  text-align: left;
  white-space: normal;
  max-width: 100%;
}

/* ── Image Generation Slots ─────────────────────────────────────────── */
.rp-imgtile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 220px;
  min-height: 140px;
  padding: 14px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px dashed var(--yh-border-strong);
  background: var(--yh-paper);
  color: var(--yh-neutral-6);
  font-size: 12px;
  line-height: 18px;
}
.rp-imgfail {
  border-style: solid;
  max-width: 300px;
  overflow: auto;
  color: var(--yh-error);
}
.rp-imgspin {
  flex: none;
  width: 15px;
  height: 15px;
  border: 2px solid var(--yh-border);
  border-top-color: var(--yh-accent);
  border-radius: 50%;
  animation: rp-imgspin 0.85s linear infinite;
}
@keyframes rp-imgspin {
  to { transform: rotate(360deg); }
}

/* ── Character Opening Message (Prologue / Letter Style) ────────────── */
[data-rp-opening] {
  display: flex;
  width: 100%;
}
.rp-opening {
  width: 100%;
  max-width: 100%;
  background: transparent;
  border: none;
  border-left: 2.5px solid var(--yh-accent-line);
  padding: 2px 0 16px 14px;
  box-sizing: border-box;
  box-shadow: none;
}
.rp-opening-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--yh-border-subtle);
}
.rp-greeting-switcher {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border-subtle);
  border-radius: 6px;
  padding: 1px 4px;
  margin-left: auto;
}
.rp-greeting-btn {
  background: transparent;
  border: none;
  color: var(--yh-neutral-7);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.rp-greeting-btn:hover:not(:disabled) {
  color: var(--yh-accent);
  background: var(--yh-accent-soft);
}
.rp-greeting-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.rp-greeting-count {
  font-family: var(--yh-font-mono);
  font-size: 11px;
  color: var(--yh-neutral-6);
  padding: 0 4px;
}
.rp-greeting-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-greeting-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rp-opening-head .rp-avatar, .rp-opening-head .rp-avatar-fallback {
  width: 24px;
  height: 24px;
  font-size: 12px;
}
.rp-opening-name {
  font-family: var(--yh-font-serif);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--yh-accent);
}
.rp-opening-tag {
  font-family: var(--yh-font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--yh-accent);
  background: var(--yh-accent-soft);
  border: 1px solid var(--yh-accent-line);
  border-radius: 4px;
  padding: 0 6px;
  line-height: 16px;
}
.rp-opening-body {
  font-family: var(--yh-font-serif);
  font-size: 14.5px;
  line-height: 26px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--yh-neutral-9);
}

/* ── Prose & Dialogue Highlight ─────────────────────────────────────── */
.rp-say {
  color: var(--yh-accent);
  font-weight: 500;
}
.rp-think {
  color: var(--yh-neutral-6);
  font-style: italic;
}
.rp-speaker {
  display: inline-block;
  font-size: 0.88em;
  font-weight: 600;
  color: var(--yh-accent);
  background: var(--yh-accent-soft);
  border: 1px solid var(--yh-accent-line);
  border-radius: 999px;
  padding: 0 6px;
  margin-right: 4px;
}
::highlight(rp-say) {
  color: var(--yh-accent);
  font-weight: 500;
}
::highlight(rp-think) {
  color: var(--yh-neutral-6);
  font-style: italic;
}
::highlight(rp-speaker) {
  color: var(--yh-accent);
  font-weight: 600;
}

/* ── Message Action Row ─────────────────────────────────────────────── */
.rp-msg-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  margin-left: -6px;
}
.rp-msg-action {
  width: 28px;
  height: 28px;
  color: var(--yh-neutral-6);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 28px;
  justify-content: center;
  align-items: center;
  padding: 6px;
  display: inline-flex;
  transition: all 0.15s ease;
}
.rp-msg-action:hover:not(:disabled) {
  background: var(--yh-neutral-2);
  color: var(--yh-neutral-10);
}
.rp-msg-action:disabled {
  opacity: 0.35;
  cursor: default;
}

/* ── User Bubble Replica ────────────────────────────────────────────── */
.rp-user-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.rp-user-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: min(calc(var(--dsh-chat-content-width, 748px) * 0.702), 85%);
}
.rp-user-bubble {
  background: var(--yh-neutral-2);
  border: 1px solid var(--yh-border);
  max-width: 100%;
  color: var(--yh-neutral-10);
  border-radius: 18px 18px 4px 18px;
  padding: 10px 16px;
  font-family: var(--yh-font-sans);
  font-size: 15px;
  line-height: 24px;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
.rp-user-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.rp-user-row .rp-msg-actions {
  margin-left: 0;
  margin-right: -6px;
}
.rp-user-edit {
  font-size: 15px;
  line-height: 24px;
  min-height: 96px;
}
.rp-user-instruction {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--yh-border-strong);
  font-family: var(--yh-font-mono);
  font-size: 11.5px;
  line-height: 18px;
  color: var(--yh-neutral-6);
  white-space: pre-wrap;
}

[data-rp-question-dock] {
  margin-bottom: 8px;
}

/* ── Gallery Page ───────────────────────────────────────────────────── */
.rp-usage {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-usage-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-family: var(--yh-font-mono);
  color: var(--yh-neutral-6);
}
.rp-usage-track {
  height: 6px;
  border-radius: 6px;
  background: var(--yh-neutral-3);
  overflow: hidden;
}
.rp-usage-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--yh-accent-medium), var(--yh-accent));
}

.rp-tilegrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.rp-tile {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--yh-border);
  background: var(--yh-paper);
  box-shadow: var(--yh-shadow-card);
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.rp-tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--yh-shadow-card-hover);
  border-color: var(--yh-accent-line);
}
.rp-tile img {
  display: block;
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
  cursor: pointer;
}
.rp-tile-selected {
  outline: 2px solid var(--yh-accent);
  outline-offset: -2px;
}
.rp-tile-star {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border-radius: 26px;
  border: none;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, background 0.15s ease;
}
.rp-tile-star:hover {
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.65);
}
.rp-tile-star.rp-on {
  color: #ffd166;
}
.rp-tile-check {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 22px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 12px;
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.rp-tile-check.rp-on {
  display: inline-flex;
  background: var(--yh-accent);
}
.rp-tile-size {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-family: var(--yh-font-mono);
  font-size: 10px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}

.rp-tile-scope {
  position: absolute;
  left: 6px;
  bottom: 6px;
  margin-right: 0;
  backdrop-filter: blur(8px);
}

/* ── Mobile (MOB) & Tablet Responsive Compatibility ─────────────────── */
@media (max-width: 860px) {
  .rp-dock-secondary-group {
    display: none !important;
  }
  .rp-dock-more-wrap,
  .rp-popover.rp-dock-more-wrap,
  .rp-btn.rp-dock-more-btn {
    display: inline-flex !important;
  }
}

@media (max-width: 768px) {
  .rp-dock {
    width: calc(100% - 12px);
    padding: 8px 10px;
    border-radius: 12px;
    gap: 6px;
  }

  .rp-dock-row {
    gap: 6px;
  }

  /* Allow flexible wrap and touch targets */
  .rp-dock-row-oneline {
    gap: 6px;
  }

  .rp-name {
    font-size: 13.5px;
    max-width: 110px;
  }

  .rp-avatar, .rp-avatar-fallback {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .rp-btn {
    min-height: 32px;
    padding: 4px 9px;
    font-size: 11.5px;
    border-radius: 8px;
    touch-action: manipulation;
  }

  /* Responsive card grid */
  .rp-cardgrid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
    max-height: 240px;
  }
  .rp-cardcell {
    padding: 7px 8px;
    gap: 8px;
  }
  .rp-cardcell .rp-cardname {
    font-size: 12.5px;
  }
  .rp-cardcell .rp-cardnote {
    font-size: 10.5px;
  }

  /* Popover placement safety on narrow screens */
  .rp-popover-panel {
    width: min(calc(100vw - 20px), 340px);
    left: auto;
    right: 0;
    padding: 10px;
    bottom: calc(100% + 6px);
  }

  /* Story bubbles on mobile: expand to use screen width */
  body[data-rp-active="1"] [data-chat-flow-kind="assistant-step"] {
    max-width: 100% !important;
    min-width: 0 !important;
    padding: 0;
    font-size: 14.5px;
    line-height: 1.68;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .rp-user-stack {
    max-width: 94% !important;
  }
  .rp-user-bubble {
    font-size: 14px;
    line-height: 22px;
    padding: 8px 12px;
    border-radius: 14px 14px 4px 14px;
  }

  .rp-opening {
    max-width: 100% !important;
    min-width: 0 !important;
    padding: 2px 0 12px 10px;
    background: transparent;
    border: none;
    box-shadow: none;
  }
  .rp-opening-body {
    font-size: 13.5px;
    line-height: 22px;
  }

  /* Settings and editor stacking */
  .rp-inline {
    flex-direction: column;
    gap: 6px;
  }
  .rp-inline .rp-field {
    width: 100%;
    min-width: 0;
  }

  .rp-editor-avatar-row {
    flex-wrap: wrap;
    gap: 10px;
  }
  .rp-editor-avatar {
    width: 56px;
    height: 56px;
  }

  /* Image gallery mobile grid */
  .rp-tilegrid {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
  }
  .rp-tile-star {
    width: 30px;
    height: 30px;
    font-size: 16px;
  }

  /* Lightbox touch optimization */
  .rp-lightbox {
    padding: 12px;
  }
  .rp-lightbox-close {
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
  }
  .rp-lightbox-img {
    max-height: calc(100vh - 48px);
  }

  /* Mobile card manager & rows */
  .rp-cardrow {
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 12px;
  }
  .rp-cardrow-info {
    width: calc(100% - 56px);
  }
  .rp-cardrow-actions {
    width: 100%;
    justify-content: flex-end;
    border-top: 1px solid var(--yh-border-subtle);
    padding-top: 8px;
    margin-top: 2px;
    gap: 6px;
  }
  .rp-card-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .rp-filter-pills {
    overflow-x: auto;
    width: 100%;
    box-sizing: border-box;
    justify-content: space-between;
  }
}

@media (max-width: 480px) {
  .rp-dock {
    width: calc(100% - 8px);
    padding: 7px 8px;
  }

  .rp-dock-row {
    gap: 4px;
  }

  .rp-name {
    max-width: 80px;
    font-size: 13px;
  }

  .rp-btn {
    padding: 4px 7px;
    font-size: 11px;
    gap: 4px;
  }

  .rp-cardgrid {
    grid-template-columns: 1fr;
  }
}

/* ── Swipe branching ── */
.rp-swipe-control {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border);
  border-radius: 14px;
  padding: 1px 4px;
  font-size: 11px;
  color: var(--yh-neutral-7);
  user-select: none;
}
.rp-swipe-btn {
  background: none;
  border: none;
  padding: 0 4px;
  cursor: pointer;
  color: var(--yh-neutral-7);
  font-size: 13px;
  line-height: 18px;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.rp-swipe-btn:hover:not(:disabled) {
  background: var(--yh-neutral-3);
  color: var(--yh-neutral-10);
}
.rp-swipe-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.rp-swipe-num {
  font-feature-settings: 'tnum';
  padding: 0 3px;
  font-size: 11px;
}

.rp-assistant-editbox {
  animation: rp-fade-in 0.15s ease-out;
}

/* ── Mounted lorebooks & Worldbook manager ── */
.rp-mounted-lb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 6px;
}
.rp-mounted-lb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--yh-neutral-9);
  cursor: pointer;
}

/* ── Typography & reading customization ── */
body[data-rp-font-size="13"] [data-chat-flow-kind="assistant-step"],
body[data-rp-font-size="13"] .rp-opening-body {
  font-size: 13px !important;
  line-height: 1.65 !important;
}
body[data-rp-font-size="15"] [data-chat-flow-kind="assistant-step"],
body[data-rp-font-size="15"] .rp-opening-body {
  font-size: 15px !important;
  line-height: 1.75 !important;
}
body[data-rp-font-size="16"] [data-chat-flow-kind="assistant-step"],
body[data-rp-font-size="16"] .rp-opening-body {
  font-size: 16px !important;
  line-height: 1.8 !important;
}

body[data-rp-font="serif"] [data-chat-flow-kind="assistant-step"],
body[data-rp-font="serif"] .rp-opening-body {
  font-family: 'Songti SC', 'SimSun', 'Noto Serif SC', 'Source Han Serif SC', serif !important;
}
body[data-rp-font="sans"] [data-chat-flow-kind="assistant-step"],
body[data-rp-font="sans"] .rp-opening-body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif !important;
}

body[data-rp-highlight="true"] .rp-say,
body[data-rp-highlight="true"] ::highlight(rp-say) {
  font-weight: 550 !important;
  filter: contrast(1.15);
}


/* ── Phase 3: Group Chat, Recap, Inspector Styles ──────────────────── */
.rp-dock-group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--yh-border);
  flex-wrap: wrap;
}

.rp-group-roster {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rp-group-pill {
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 8px;
  border: 1px solid var(--yh-border);
  background: var(--yh-neutral-1);
  color: var(--yh-neutral-8);
  font-size: 12px;
  transition: all 0.15s ease;
}

.rp-group-pill:hover {
  background: var(--yh-neutral-2);
  border-color: var(--yh-border-strong);
  color: var(--yh-neutral-10);
}

.rp-group-pill.rp-speaker-active {
  border-color: var(--yh-accent);
  background: var(--yh-accent-soft);
  color: var(--yh-accent);
  font-weight: 600;
  box-shadow: 0 0 0 1px var(--yh-accent);
}

.rp-group-crown {
  font-size: 11px;
}

.rp-group-remove {
  cursor: pointer;
  margin-left: 2px;
  opacity: 0.45;
  font-size: 13px;
  line-height: 1;
}

.rp-group-remove:hover {
  opacity: 1;
  color: var(--yh-error);
}

.rp-btn-talk-to {
  font-size: 11px;
  padding: 3px 8px;
}

.rp-btn-exit-group {
  font-size: 11px;
  padding: 3px 8px;
  color: var(--yh-neutral-7);
  transition: all 0.15s ease;
}
.rp-btn-exit-group:hover {
  color: var(--yh-error);
  border-color: var(--yh-error);
  background: var(--yh-error-soft, rgba(239, 68, 68, 0.08));
}

/* ── Inspector Tray ─────────────────────────────────────────────────── */
.rp-inspector-panel {
  max-height: 520px;
  display: flex;
  flex-direction: column;
}

.rp-inspector-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rp-inspector-total-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--yh-accent-soft);
  color: var(--yh-accent);
  font-weight: 600;
}

.rp-inspector-tabs {
  display: flex;
  gap: 6px;
  margin: 6px 0 10px;
  border-bottom: 1px solid var(--yh-border);
  padding-bottom: 6px;
}

.rp-inspector-tab {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--yh-neutral-7);
  border-radius: 6px;
  transition: all 0.15s;
}

.rp-inspector-tab:hover {
  color: var(--yh-neutral-10);
}

.rp-inspector-tab.rp-active {
  background: var(--yh-neutral-2);
  color: var(--yh-neutral-10);
  font-weight: 600;
}

.rp-progress-bar {
  height: 12px;
  border-radius: 6px;
  display: flex;
  overflow: hidden;
  background: var(--yh-neutral-2);
  margin: 8px 0 12px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
}

.rp-bar-seg {
  height: 100%;
  transition: width 0.3s ease;
}

.rp-bar-sys { background: #8a63d2; }
.rp-bar-char { background: #3f83f8; }
.rp-bar-lore { background: #0e9f6e; }
.rp-bar-mem { background: #e3a008; }
.rp-bar-note { background: #f05252; }
.rp-bar-hist { background: #9ca3af; }

.rp-inspector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.rp-stat-card {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rp-stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.rp-dot-sys { background: #8a63d2; }
.rp-dot-char { background: #3f83f8; }
.rp-dot-lore { background: #0e9f6e; }
.rp-dot-mem { background: #e3a008; }
.rp-dot-note { background: #f05252; }
.rp-dot-hist { background: #9ca3af; }

.rp-stat-label {
  font-size: 11px;
  color: var(--yh-neutral-6);
}

.rp-stat-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--yh-neutral-9);
}

.rp-stat-pct {
  font-size: 10px;
  color: var(--yh-neutral-5);
}

.rp-inspector-meta {
  font-size: 11px;
  color: var(--yh-neutral-6);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px dashed var(--yh-border);
}

.rp-radar-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.rp-radar-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-border);
}

.rp-radar-item.rp-matched {
  border-color: rgba(14, 159, 110, 0.4);
  background: rgba(14, 159, 110, 0.04);
}

.rp-radar-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rp-radar-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.rp-badge-matched {
  background: rgba(14, 159, 110, 0.15);
  color: #0e9f6e;
}

.rp-badge-constant {
  background: rgba(63, 131, 248, 0.15);
  color: #3f83f8;
}

.rp-badge-idle {
  background: rgba(156, 163, 175, 0.15);
  color: #6b7280;
}

.rp-radar-item-detail {
  font-size: 11px;
  color: var(--yh-neutral-6);
  margin-top: 4px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rp-radar-hit {
  color: #0e9f6e;
  font-weight: 500;
}

.rp-raw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rp-raw-textarea {
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}

.rp-recap-preview {
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: var(--yh-neutral-1);
  border: 1px solid var(--yh-accent-line);
}

.rp-recap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rp-recap-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--yh-accent);
}

.rp-recap-text {
  margin: 0;
  font-family: var(--yh-font-sans);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--yh-neutral-8);
}

.rp-btn-recap {
  color: var(--yh-accent);
  font-weight: 500;
}

.rp-character-pill {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9em;
  background: var(--yh-neutral-2);
  color: var(--yh-neutral-9);
  margin-right: 4px;
}

`

export function injectCss(): void {
  if (typeof document === 'undefined') return
  const existing = document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG)}]`)
  if (existing !== null) {
    existing.textContent = CSS
    return
  }
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin-css', CSS_TAG)
  tag.textContent = CSS
  document.head.appendChild(tag)
}
