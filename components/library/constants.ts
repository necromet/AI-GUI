import React from 'react';
import { Package, Layers, LayoutGrid, Palette, FileCode, FileText, FileJson, FileType } from 'lucide-react';
import { LibraryComponentFile } from '../../types';

export const CATEGORIES = [
  { key: 'all', label: 'All', icon: React.createElement(Package, { size: 12 }) },
  { key: 'ui-widget', label: 'Widgets', icon: React.createElement(LayoutGrid, { size: 12 }) },
  { key: 'template', label: 'Templates', icon: React.createElement(Layers, { size: 12 }) },
  { key: 'theme', label: 'Themes', icon: React.createElement(Palette, { size: 12 }) },
];

export const CATEGORY_LABELS: Record<string, string> = {
  'ui-widget': 'Widget',
  'template': 'Template',
  'theme': 'Theme',
};

export const THEME_CSS_TEMPLATE = `:root {
  --card: #ffffff;
  --ring: #8839ef;
  --input: #ccd0da;
  --muted: #dce0e8;
  --accent: #04a5e5;
  --border: #bcc0cc;
  --radius: 0.35rem;
  --chart-1: #8839ef;
  --chart-2: #04a5e5;
  --chart-3: #40a02b;
  --chart-4: #fe640b;
  --chart-5: #dc8a78;
  --popover: #ccd0da;
  --primary: #8839ef;
  --sidebar: #e6e9ef;
  --font-mono: Fira Code, monospace;
  --font-sans: Montserrat, sans-serif;
  --secondary: #ccd0da;
  --background: #eff1f5;
  --font-serif: Georgia, serif;
  --foreground: #4c4f69;
  --destructive: #d20f39;
  --shadow-blur: 6px;
  --shadow-color: hsl(240 30% 25%);
  --sidebar-ring: #8839ef;
  --shadow-spread: 0px;
  --shadow-opacity: 0.12;
  --sidebar-accent: #04a5e5;
  --sidebar-border: #bcc0cc;
  --card-foreground: #4c4f69;
  --shadow-offset-x: 0px;
  --shadow-offset-y: 4px;
  --sidebar-primary: #8839ef;
  --muted-foreground: #6c6f85;
  --accent-foreground: #ffffff;
  --popover-foreground: #4c4f69;
  --primary-foreground: #ffffff;
  --sidebar-foreground: #4c4f69;
  --secondary-foreground: #4c4f69;
  --destructive-foreground: #ffffff;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-primary-foreground: #ffffff;
}

.dark {
  --card: #1e1e2e;
  --ring: #cba6f7;
  --input: #313244;
  --muted: #292c3c;
  --accent: #89dceb;
  --border: #313244;
  --chart-1: #cba6f7;
  --chart-2: #89dceb;
  --chart-3: #a6e3a1;
  --chart-4: #fab387;
  --chart-5: #f5e0dc;
  --popover: #45475a;
  --primary: #cba6f7;
  --sidebar: #11111b;
  --secondary: #585b70;
  --background: #181825;
  --foreground: #cdd6f4;
  --destructive: #f38ba8;
  --sidebar-ring: #cba6f7;
  --sidebar-accent: #89dceb;
  --sidebar-border: #45475a;
  --card-foreground: #cdd6f4;
  --sidebar-primary: #cba6f7;
  --muted-foreground: #a6adc8;
  --accent-foreground: #1e1e2e;
  --popover-foreground: #cdd6f4;
  --primary-foreground: #1e1e2e;
  --sidebar-foreground: #cdd6f4;
  --secondary-foreground: #cdd6f4;
  --destructive-foreground: #1e1e2e;
  --sidebar-accent-foreground: #1e1e2e;
  --sidebar-primary-foreground: #1e1e2e;
}`;


export const THEME_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard</title>
<link rel="stylesheet" href="theme.css">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-sans); background: var(--background); color: var(--foreground); min-height: 100vh; display: flex; }
a { color: inherit; text-decoration: none; }

.sidebar { width: 240px; min-height: 100vh; background: var(--sidebar); border-right: 1px solid var(--sidebar-border); padding: 1rem; display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.sidebar-logo { font-size: 1rem; font-weight: 700; color: var(--sidebar-foreground); padding: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
.sidebar-logo svg { width: 20px; height: 20px; color: var(--sidebar-primary); }
.sidebar-section { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); padding: 0.5rem 0.5rem 0.25rem; }
.sidebar-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: var(--radius); font-size: 0.8125rem; color: var(--sidebar-foreground); cursor: pointer; transition: background 0.15s; }
.sidebar-item:hover { background: var(--sidebar-accent); color: var(--sidebar-accent-foreground); }
.sidebar-item.active { background: var(--sidebar-primary); color: var(--sidebar-primary-foreground); font-weight: 600; }
.sidebar-item svg { width: 16px; height: 16px; opacity: 0.7; }
.sidebar-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--sidebar-border); }
.sidebar-user { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; }
.sidebar-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--sidebar-primary); display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; color: var(--sidebar-primary-foreground); }

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--card); }
.topbar-title { font-size: 0.9375rem; font-weight: 700; }
.content { flex: 1; padding: 1.5rem; overflow-y: auto; }

.card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; box-shadow: 0 var(--shadow-offset-y) var(--shadow-blur) var(--shadow-spread) var(--shadow-color); }
.card-lg { padding: 1.5rem; }
.card-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.375rem; }
.card-title-sm { font-size: 0.8125rem; color: var(--muted-foreground); font-weight: 600; margin-bottom: 0.25rem; }
.card-subtitle { font-size: 0.8125rem; color: var(--muted-foreground); margin-bottom: 1.5rem; line-height: 1.5; }
.card-value { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; }
.card-change { font-size: 0.6875rem; font-weight: 600; margin-top: 0.25rem; }
.card-change.up { color: var(--chart-3); }
.card-change.down { color: var(--destructive); }
.card + .card { margin-top: 1rem; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start; }
.two-col-wide { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: start; margin-bottom: 1.5rem; }

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }

.field { margin-bottom: 1rem; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.field-row-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
label.field-label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.375rem; }
.input, textarea.input {
  width: 100%; padding: 0.625rem 0.75rem; background: var(--background);
  border: 1px solid var(--input); border-radius: var(--radius);
  font-size: 0.8125rem; color: var(--foreground); outline: none; font-family: inherit;
}
.input:focus, textarea.input:focus { border-color: var(--ring); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent); }
.input::placeholder { color: var(--muted-foreground); opacity: 0.7; }
textarea.input { resize: vertical; min-height: 70px; }

.plan-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
.plan-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 0.875rem; cursor: pointer; display: flex; gap: 0.625rem; align-items: flex-start; }
.plan-card.selected { border-color: var(--ring); box-shadow: 0 0 0 1px var(--ring); }
.plan-radio { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--border); flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
.plan-card.selected .plan-radio { border-color: var(--ring); }
.plan-radio::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--ring); display: none; }
.plan-card.selected .plan-radio::after { display: block; }
.plan-title { font-size: 0.875rem; font-weight: 700; margin-bottom: 0.125rem; }
.plan-desc { font-size: 0.75rem; color: var(--muted-foreground); }

.check-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; margin-bottom: 0.625rem; }
.checkbox { width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.checkbox.checked { background: var(--primary); border-color: var(--primary); }
.checkbox.checked::after { content: '\\2713'; color: var(--primary-foreground); font-size: 11px; font-weight: 700; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.625rem 1rem; border-radius: var(--radius); font-size: 0.8125rem; font-weight: 600; border: none; cursor: pointer; transition: opacity 0.15s; }
.btn:hover { opacity: 0.9; }
.btn-primary { background: var(--primary); color: var(--primary-foreground); }
.btn-outline { background: transparent; color: var(--foreground); border: 1px solid var(--border); }
.btn-full { width: 100%; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; }

.oauth-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
.btn-oauth { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.625rem; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: var(--foreground); font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.btn-oauth:hover { background: var(--muted); }
.divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.25rem 0; font-size: 0.6875rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

.toggle-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
.toggle-row:last-of-type { margin-bottom: 1.5rem; }
.toggle-label { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; }
.toggle-desc { font-size: 0.75rem; color: var(--muted-foreground); line-height: 1.5; }
.toggle { position: relative; width: 36px; height: 20px; background: var(--input); border-radius: 10px; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
.toggle.on { background: var(--primary); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: transform 0.2s; }
.toggle.on::after { transform: translateX(16px); }

.team-member { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; }
.team-member + .team-member { border-top: 1px solid var(--border); }
.avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; background: var(--muted); color: var(--foreground); }
.team-name { font-size: 0.8125rem; font-weight: 600; }
.team-email { font-size: 0.75rem; color: var(--muted-foreground); }
.role-badge { margin-left: auto; padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.75rem; font-weight: 600; background: transparent; }

.bar-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.625rem; }
.bar-label { font-size: 0.75rem; color: var(--muted-foreground); width: 40px; flex-shrink: 0; text-align: right; }
.bar-track { flex: 1; height: 24px; background: var(--muted); border-radius: var(--radius); overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: var(--radius); transition: width 0.6s ease; }
.bar-value { font-size: 0.6875rem; font-weight: 600; margin-left: 0.5rem; width: 36px; flex-shrink: 0; }

.sparkline { display: flex; align-items: flex-end; gap: 3px; height: 48px; }
.spark-bar { flex: 1; border-radius: 2px 2px 0 0; transition: height 0.3s ease; }

.table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.table th { text-align: left; padding: 0.625rem 0.75rem; font-size: 0.6875rem; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); }
.table td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); }
.table tr:last-child td { border-bottom: none; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 0.375rem; }
.status-active { background: var(--chart-3); }
.status-pending { background: var(--chart-4); }
.status-inactive { background: var(--destructive); }

.badge { display: inline-flex; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; line-height: 1.5; }
.badge-primary { background: var(--primary); color: var(--primary-foreground); }
.badge-secondary { background: var(--secondary); color: var(--secondary-foreground); }

.section-divider { height: 1px; background: var(--border); margin: 2rem 0; }
.section-heading { font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem; }
.section-desc { font-size: 0.8125rem; color: var(--muted-foreground); margin-bottom: 1.25rem; }
</style>
</head>
<body>

<nav class="sidebar">
  <div class="sidebar-logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
    Dashboard
  </div>
  <div class="sidebar-section">Platform</div>
  <div class="sidebar-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
    Analytics
  </div>
  <div class="sidebar-item active">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    Overview
  </div>
  <div class="sidebar-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    Users
  </div>
  <div class="sidebar-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    Billing
  </div>
  <div class="sidebar-section">Settings</div>
  <div class="sidebar-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    Settings
  </div>
  <div class="sidebar-footer">
    <div class="sidebar-user">
      <div class="sidebar-avatar">JD</div>
      <div>
        <div style="font-size:0.8125rem;font-weight:600">John Doe</div>
        <div style="font-size:0.6875rem;color:var(--muted-foreground)">john@example.com</div>
      </div>
    </div>
  </div>
</nav>

<div class="main">
  <div class="topbar">
    <div class="topbar-title">Overview</div>
    <div style="display:flex;gap:0.5rem">
      <span class="badge badge-secondary">Last 30 days</span>
    </div>
  </div>

  <div class="content">

    <!-- ─── Theme Showcase ─── -->
    <div class="card card-lg" style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <div style="width:40px;height:40px;border-radius:var(--radius);background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0"></div>
          <div><div style="font-weight:700;font-size:1.125rem;line-height:1.3">Theme Preview</div><div style="font-size:0.8125rem;color:var(--muted-foreground)">CSS variables showcase</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;color:var(--muted-foreground)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          shadcn/ui
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2rem">
        <div>
          <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.75rem">Colors</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:0.5rem">
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--primary);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Primary</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--secondary);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Secondary</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--accent);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Accent</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--muted);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Muted</span></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem">
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--destructive);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Destructive</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--border);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Border</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--card);border:1px solid var(--border);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Card</span></div>
            <div><div style="width:100%;height:56px;border-radius:var(--radius);background:var(--background);border:1px solid var(--border);margin-bottom:6px"></div><span style="font-size:0.75rem;color:var(--muted-foreground)">Background</span></div>
          </div>
        </div>
        <div>
          <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.75rem">Typography</div>
          <div style="font-size:1.5rem;font-weight:700;margin-bottom:0.25rem">Heading</div>
          <div style="font-size:0.8125rem;margin-bottom:0.25rem;color:var(--muted-foreground)">Subtitle text</div>
          <div style="font-size:0.75rem;color:var(--muted-foreground)">Body copy and captions</div>
        </div>
        <div>
          <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.75rem">Radius</div>
          <div style="display:flex;gap:0.5rem">
            <div style="width:44px;height:44px;border-radius:0;border:2px solid var(--ring)"></div>
            <div style="width:44px;height:44px;border-radius:6px;border:2px solid var(--ring)"></div>
            <div style="width:44px;height:44px;border-radius:12px;border:2px solid var(--ring)"></div>
            <div style="width:44px;height:44px;border-radius:999px;border:2px solid var(--ring)"></div>
          </div>
        </div>
      </div>

      <div style="height:1px;background:var(--border);margin:1.5rem 0"></div>

      <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.75rem">Components</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
        <button class="btn btn-primary" style="padding:0.375rem 0.75rem;font-size:0.8125rem">Primary</button>
        <button class="btn" style="padding:0.375rem 0.75rem;font-size:0.8125rem;background:var(--secondary);color:var(--secondary-foreground)">Secondary</button>
        <button class="btn btn-outline" style="padding:0.375rem 0.75rem;font-size:0.8125rem">Outline</button>
        <button class="btn" style="padding:0.375rem 0.75rem;font-size:0.8125rem;background:transparent;color:var(--foreground)">Ghost</button>
        <button class="btn" style="padding:0.375rem 0.75rem;font-size:0.8125rem;background:var(--destructive);color:var(--destructive-foreground)">Delete</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1.25rem">
        <span class="badge badge-primary">Badge</span>
        <span class="badge badge-secondary">Secondary</span>
        <span class="badge" style="background:transparent;color:var(--foreground);border:1px solid var(--border)">Outline</span>
        <span class="badge" style="background:var(--destructive);color:var(--destructive-foreground)">Error</span>
        <div style="display:flex;margin-left:auto">
          <div class="avatar" style="background:var(--secondary);color:var(--secondary-foreground);width:26px;height:26px;font-size:0.625rem">S</div>
          <div class="avatar" style="background:var(--accent);color:var(--accent-foreground);width:26px;height:26px;font-size:0.625rem;margin-left:-6px">J</div>
          <div class="avatar" style="background:var(--primary);color:var(--primary-foreground);width:26px;height:26px;font-size:0.625rem;margin-left:-6px">I</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5rem;align-items:start">
        <div><div style="font-size:0.75rem;margin-bottom:6px;color:var(--muted-foreground)">Email</div><input class="input" placeholder="m@example.com" style="background:var(--background);border-color:var(--input)" /></div>
        <div style="display:flex;align-items:center;gap:1rem;padding-top:20px"><div class="toggle on"></div><label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem"><input type="checkbox" checked style="accent-color:var(--primary)" /> Controls</label></div>
        <div style="display:flex;flex-direction:column;gap:0.75rem;padding-top:20px">
          <input type="range" value="90" min="0" max="100" style="width:100%;height:6px;border-radius:999px;background:var(--secondary);appearance:none;-webkit-appearance:none;outline:none" />
          <input type="range" value="40" min="0" max="100" style="width:100%;height:6px;border-radius:999px;background:var(--secondary);appearance:none;-webkit-appearance:none;outline:none" />
        </div>
      </div>
    </div>

    <!-- ─── Analytics Section ─── -->
    <div class="section-heading">Analytics</div>
    <div class="section-desc">Track your key metrics and growth trends across all channels.</div>

    <div class="stat-grid">
      <div class="card">
        <div class="card-title-sm">Total Revenue</div>
        <div class="card-value">$45,231</div>
        <div class="card-change up">+20.1% from last month</div>
        <div class="sparkline" style="margin-top:0.75rem">
          <div class="spark-bar" style="height:30%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:55%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:40%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:70%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:50%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:85%;background:var(--chart-1)"></div>
          <div class="spark-bar" style="height:100%;background:var(--chart-1)"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title-sm">Active Users</div>
        <div class="card-value">2,350</div>
        <div class="card-change up">+180.1% from last month</div>
        <div class="sparkline" style="margin-top:0.75rem">
          <div class="spark-bar" style="height:20%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:35%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:45%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:55%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:65%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:80%;background:var(--chart-2)"></div>
          <div class="spark-bar" style="height:95%;background:var(--chart-2)"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title-sm">Conversion Rate</div>
        <div class="card-value">3.2%</div>
        <div class="card-change down">-0.4% from last week</div>
        <div class="sparkline" style="margin-top:0.75rem">
          <div class="spark-bar" style="height:80%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:70%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:75%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:60%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:55%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:50%;background:var(--chart-3)"></div>
          <div class="spark-bar" style="height:45%;background:var(--chart-3)"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title-sm">Avg. Session</div>
        <div class="card-value">4m 12s</div>
        <div class="card-change up">+8.2% from last week</div>
        <div class="sparkline" style="margin-top:0.75rem">
          <div class="spark-bar" style="height:50%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:55%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:60%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:45%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:70%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:75%;background:var(--chart-4)"></div>
          <div class="spark-bar" style="height:80%;background:var(--chart-4)"></div>
        </div>
      </div>
    </div>

    <div class="two-col-wide">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div>
            <div style="font-weight:700;font-size:1rem">Revenue by Channel</div>
            <div style="font-size:0.75rem;color:var(--muted-foreground)">Breakdown of revenue sources</div>
          </div>
        </div>
        <div class="bar-row"><div class="bar-label">Direct</div><div class="bar-track"><div class="bar-fill" style="width:78%;background:var(--chart-1)"></div></div><div class="bar-value">$18.2k</div></div>
        <div class="bar-row"><div class="bar-label">Organic</div><div class="bar-track"><div class="bar-fill" style="width:62%;background:var(--chart-2)"></div></div><div class="bar-value">$14.3k</div></div>
        <div class="bar-row"><div class="bar-label">Referral</div><div class="bar-track"><div class="bar-fill" style="width:45%;background:var(--chart-3)"></div></div><div class="bar-value">$8.1k</div></div>
        <div class="bar-row"><div class="bar-label">Social</div><div class="bar-track"><div class="bar-fill" style="width:30%;background:var(--chart-4)"></div></div><div class="bar-value">$4.6k</div></div>
      </div>
      <div class="card">
        <div style="font-weight:700;font-size:1rem;margin-bottom:1rem">Top Countries</div>
        <div class="bar-row"><div class="bar-label">US</div><div class="bar-track"><div class="bar-fill" style="width:85%;background:var(--primary)"></div></div><div class="bar-value">42%</div></div>
        <div class="bar-row"><div class="bar-label">UK</div><div class="bar-track"><div class="bar-fill" style="width:55%;background:var(--primary)"></div></div><div class="bar-value">18%</div></div>
        <div class="bar-row"><div class="bar-label">DE</div><div class="bar-track"><div class="bar-fill" style="width:40%;background:var(--primary)"></div></div><div class="bar-value">12%</div></div>
        <div class="bar-row"><div class="bar-label">JP</div><div class="bar-track"><div class="bar-fill" style="width:30%;background:var(--primary)"></div></div><div class="bar-value">9%</div></div>
        <div class="bar-row"><div class="bar-label">Other</div><div class="bar-track"><div class="bar-fill" style="width:38%;background:var(--muted-foreground)"></div></div><div class="bar-value">19%</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div>
          <div style="font-weight:700;font-size:1rem">Recent Activity</div>
          <div style="font-size:0.75rem;color:var(--muted-foreground)">Latest user actions on your platform</div>
        </div>
      </div>
      <table class="table">
        <thead><tr><th>User</th><th>Action</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          <tr>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--chart-1);color:#fff;width:28px;height:28px;font-size:0.6875rem">S</div><div><div style="font-weight:600;font-size:0.8125rem">Sofia Davis</div><div style="font-size:0.6875rem;color:var(--muted-foreground)">sofia@example.com</div></div></div></td>
            <td>Subscription upgrade</td>
            <td><span class="status-dot status-active"></span>Completed</td>
            <td style="text-align:right;font-weight:600">$199.00</td>
          </tr>
          <tr>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--chart-2);color:#fff;width:28px;height:28px;font-size:0.6875rem">J</div><div><div style="font-weight:600;font-size:0.8125rem">Jackson Lee</div><div style="font-size:0.6875rem;color:var(--muted-foreground)">jackson@example.com</div></div></div></td>
            <td>New signup</td>
            <td><span class="status-dot status-active"></span>Active</td>
            <td style="text-align:right;font-weight:600">$49.00</td>
          </tr>
          <tr>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--chart-3);color:#fff;width:28px;height:28px;font-size:0.6875rem">I</div><div><div style="font-weight:600;font-size:0.8125rem">Isabella Nguyen</div><div style="font-size:0.6875rem;color:var(--muted-foreground)">isabella@example.com</div></div></div></td>
            <td>Payment pending</td>
            <td><span class="status-dot status-pending"></span>Pending</td>
            <td style="text-align:right;font-weight:600">$299.00</td>
          </tr>
          <tr>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--destructive);color:#fff;width:28px;height:28px;font-size:0.6875rem">W</div><div><div style="font-weight:600;font-size:0.8125rem">William Kim</div><div style="font-size:0.6875rem;color:var(--muted-foreground)">will@example.com</div></div></div></td>
            <td>Subscription cancelled</td>
            <td><span class="status-dot status-inactive"></span>Cancelled</td>
            <td style="text-align:right;font-weight:600">$99.00</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ─── Forms Section ─── -->
    <div class="section-divider"></div>
    <div class="section-heading">Forms</div>
    <div class="section-desc">Subscription plans, account creation, and settings forms.</div>

    <div class="two-col">

      <div>
        <div class="card card-lg">
          <div class="card-title">Upgrade your subscription</div>
          <div class="card-subtitle">You are currently on the free plan. Upgrade to the pro plan to get access to all features.</div>

          <div class="field-row">
            <div>
              <label class="field-label">Name</label>
              <input class="input" value="Evil Rabbit" />
            </div>
            <div>
              <label class="field-label">Email</label>
              <input class="input" placeholder="example@acme.com" />
            </div>
          </div>

          <label class="field-label">Card Number</label>
          <div class="field-row-3">
            <input class="input" placeholder="1234 1234 1234 1234" />
            <input class="input" placeholder="MM/YY" />
            <input class="input" placeholder="CVC" />
          </div>

          <label class="field-label">Plan</label>
          <div class="card-subtitle" style="margin-bottom:0.75rem">Select the plan that best fits your needs.</div>
          <div class="plan-options">
            <div class="plan-card selected">
              <div class="plan-radio"></div>
              <div>
                <div class="plan-title">Starter Plan</div>
                <div class="plan-desc">Perfect for small businesses.</div>
              </div>
            </div>
            <div class="plan-card">
              <div class="plan-radio"></div>
              <div>
                <div class="plan-title">Pro Plan</div>
                <div class="plan-desc">More features and storage.</div>
              </div>
            </div>
          </div>

          <label class="field-label">Notes</label>
          <textarea class="input" placeholder="Enter notes"></textarea>

          <div style="margin-top:1rem">
            <div class="check-row">
              <div class="checkbox"></div>
              I agree to the terms and conditions
            </div>
            <div class="check-row">
              <div class="checkbox checked"></div>
              Allow us to send you emails
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-outline">Cancel</button>
            <button class="btn btn-primary">Upgrade Plan</button>
          </div>
        </div>

        <div class="card card-lg">
          <div class="card-title" style="font-size:1.125rem">Team Members</div>
          <div class="card-subtitle" style="margin-bottom:0.5rem">Invite your team members to collaborate.</div>

          <div class="team-member">
            <div class="avatar" style="background:var(--chart-1);color:#fff">S</div>
            <div>
              <div class="team-name">Sofia Davis</div>
              <div class="team-email">m@example.com</div>
            </div>
            <button class="role-badge">Owner</button>
          </div>
          <div class="team-member">
            <div class="avatar" style="background:var(--chart-2);color:#fff">J</div>
            <div>
              <div class="team-name">Jackson Lee</div>
              <div class="team-email">p@example.com</div>
            </div>
            <button class="role-badge">Developer</button>
          </div>
          <div class="team-member">
            <div class="avatar" style="background:var(--chart-3);color:#fff">I</div>
            <div>
              <div class="team-name">Isabella Nguyen</div>
              <div class="team-email">i@example.com</div>
            </div>
            <button class="role-badge">Billing</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card card-lg">
          <div class="card-title">Create an account</div>
          <div class="card-subtitle">Enter your email below to create your account</div>

          <div class="oauth-row">
            <button class="btn-oauth">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.7 5.41-5.28 5.69.42.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.66.8.55C20.71 21.39 24 17.08 24 12c0-6.35-5.15-11.5-12-11.5z"/></svg>
              GitHub
            </button>
            <button class="btn-oauth">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 014.9 12c0-.79.14-1.56.37-2.28V6.63H1.29A11.99 11.99 0 000 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg>
              Google
            </button>
          </div>

          <div class="divider">Or continue with</div>

          <div class="field">
            <label class="field-label">Email</label>
            <input class="input" placeholder="m@example.com" />
          </div>
          <div class="field">
            <label class="field-label">Password</label>
            <input class="input" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
          </div>

          <button class="btn btn-primary btn-full" style="margin-top:0.5rem">Create account</button>
        </div>

        <div class="card card-lg">
          <div class="card-title" style="font-size:1.125rem">Cookie Settings</div>
          <div class="card-subtitle">Manage your cookie settings here.</div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Strictly Necessary</div>
              <div class="toggle-desc">These cookies are essential in order to use the website and use its features.</div>
            </div>
            <div class="toggle on"></div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Functional Cookies</div>
              <div class="toggle-desc">These cookies allow the website to provide personalized functionality.</div>
            </div>
            <div class="toggle"></div>
          </div>

          <button class="btn btn-primary btn-full">Save preferences</button>
        </div>
      </div>

    </div>
  </div>
</div>

</body>
</html>`;
export const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  html: 'html', htm: 'html',
  css: 'css',
  js: 'js', jsx: 'js',
  ts: 'ts', tsx: 'tsx',
  json: 'json',
  md: 'markdown', markdown: 'markdown',
};

export const ACE_LANG_MAP: Record<string, 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'markdown'> = {
  html: 'html', css: 'css', js: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', markdown: 'markdown',
};

export function deriveContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_CONTENT_TYPE[ext] || 'js';
}

export function getFileIcon(filename: string) {
  if (filename.endsWith('.html')) return React.createElement(FileCode, { size: 12 });
  if (filename.endsWith('.css')) return React.createElement(FileCode, { size: 12 });
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return React.createElement(FileType, { size: 12 });
  if (filename.endsWith('.json')) return React.createElement(FileJson, { size: 12 });
  return React.createElement(FileText, { size: 12 });
}

function buildTsxPreview(componentId: string, isDark: boolean): string {
  const bodyBg = isDark ? '#1a1a1a' : '#ffffff';
  const bodyColor = isDark ? '#ececec' : '#1a1a1a';
  return `<!DOCTYPE html>
<html${isDark ? ' class="dark"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="importmap">${JSON.stringify({
    imports: {
      'react': 'https://esm.sh/react@19',
      'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
      'react-dom': 'https://esm.sh/react-dom@19',
      'react-dom/client': 'https://esm.sh/react-dom@19/client',
      'motion/react': 'https://esm.sh/motion@11/react?external=react,react-dom',
      'framer-motion': 'https://esm.sh/framer-motion@11?external=react,react-dom',
      '@phosphor-icons/react': 'https://esm.sh/@phosphor-icons/react?external=react,react-dom',
      'lucide-react': 'https://esm.sh/lucide-react@0.554.0?external=react,react-dom',
    },
  })}<\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${bodyBg}; color: ${bodyColor}; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
#root { display: flex; justify-content: center; align-items: center; width: 100%; min-height: 100vh; }
#error-overlay { position: fixed; inset: 0; background: rgba(10,10,26,0.95); color: #f87171; padding: 24px; font-size: 13px; font-family: 'JetBrains Mono', monospace, monospace; white-space: pre-wrap; overflow: auto; z-index: 9999; display: none; }
#error-overlay .err-title { color: #fca5a5; font-weight: 700; font-size: 14px; margin-bottom: 12px; }
#error-overlay .err-msg { color: #f87171; line-height: 1.6; }
#error-overlay .err-stack { color: #888; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-overlay"><div class="err-title">Preview Error</div><div class="err-msg" id="err-msg"></div><div class="err-stack" id="err-stack"></div></div>
<script type="module">
function showError(msg, stack) {
  var overlay = document.getElementById('error-overlay');
  var msgEl = document.getElementById('err-msg');
  var stackEl = document.getElementById('err-stack');
  overlay.style.display = 'block';
  msgEl.textContent = msg;
  stackEl.textContent = stack || '';
  try {
    window.parent.postMessage({ type: 'preview-errors', errors: [msg], loadErrors: [], complete: true }, '*');
  } catch(e) {}
}

window.addEventListener('error', function(e) {
  showError(e.message, e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
  showError('Unhandled rejection: ' + (e.reason?.message || e.reason || 'unknown'), e.reason?.stack);
});

try {
  const [React, ReactDOM, ReactDOMClient] = await Promise.all([
    import('react'),
    import('react-dom'),
    import('react-dom/client'),
  ]);
  if (!window.React) window.React = React;
  if (!window.ReactDOM) window.ReactDOM = { ...ReactDOM };
  if (!window.ReactDOM.createRoot) window.ReactDOM.createRoot = ReactDOMClient.createRoot;

  await import('/api/library/components/${componentId}/compiled');

  try {
    window.parent.postMessage({ type: 'preview-errors', errors: [], loadErrors: [], complete: true }, '*');
  } catch(e) {}
} catch(e) {
  showError(e.message, e.stack);
}
<\/script>
</body>
</html>`;
}

export function buildPreviewHtml(files: LibraryComponentFile[], componentId?: string, isDark: boolean = false): string {
  if (!files || files.length === 0) return '';

  const hasTsx = files.some(f => f.filename.endsWith('.tsx') || f.filename.endsWith('.jsx'));
  if (hasTsx) {
    if (!componentId) return '';
    return buildTsxPreview(componentId, isDark);
  }

  const entry = files.find(f => f.isEntry) || files.find(f => f.filename.endsWith('.html')) || files[0];
  if (!entry) return '';

  const bodyBg = isDark ? '#1a1a1a' : '#ffffff';
  const bodyColor = isDark ? '#ececec' : '#1a1a1a';
  const themeStyle = `<style>html,body{background:${bodyBg};color:${bodyColor};display:flex;justify-content:center;align-items:center;min-height:100vh}</style>`;

  if (entry.contentType === 'html') {
    let html = entry.content;
    const cssFiles = files.filter(f => f.contentType === 'css' && f.id !== entry.id);
    const jsFiles = files.filter(f => f.contentType === 'js' && f.id !== entry.id);

    const cssBlock = cssFiles.map(f => `<style data-file="${f.filename}">\n${f.content}\n</style>`).join('\n');
    const jsBlock = jsFiles.map(f => `<script data-file="${f.filename}">\n${f.content}\n<\/script>`).join('\n');

    const inject = themeStyle + '\n' + cssBlock;
    if (inject.trim()) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', inject + '\n</head>');
      } else {
        html = inject + '\n' + html;
      }
    }
    if (jsBlock) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', jsBlock + '\n</body>');
      } else {
        html = html + '\n' + jsBlock;
      }
    }
    return html;
  }

  if (entry.contentType === 'js') {
    return `<!DOCTYPE html><html><head>${themeStyle}</head><body><pre style="font-family:monospace;padding:1rem;color:${bodyColor};background:${bodyBg};min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  }

  if (entry.contentType === 'css') {
    return `<!DOCTYPE html><html><head>${themeStyle}<style>${entry.content}</style></head><body><div style="font-family:system-ui;padding:2rem;color:${isDark ? '#b4b4b4' : '#888'}"><p>CSS Preview</p><p class="test">This text uses the component's stylesheet.</p></div></body></html>`;
  }

  return `<!DOCTYPE html><html><head>${themeStyle}</head><body><pre style="font-family:monospace;padding:1rem;color:${bodyColor};background:${bodyBg};min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
}

export function buildThemePreviewHtml(files: LibraryComponentFile[], componentId?: string, isDark: boolean = false): string {
  const cssFile = files.find(f => f.filename.endsWith('.css'));
  const hasTsx = files.some(f => f.filename.endsWith('.tsx') || f.filename.endsWith('.jsx'));

  if (hasTsx && componentId) {
    return buildTsxPreview(componentId, isDark);
  }

  if (!cssFile) return buildPreviewHtml(files, componentId, isDark);

  const htmlFile = files.find(f => f.filename.endsWith('.html'));
  if (htmlFile) {
    let html = htmlFile.content;
    const hasDarkVars = /\.dark\s*\{/.test(cssFile.content) || cssFile.content.includes('.dark ');
    if (!isDark && hasDarkVars) {
      html = html.replace(/<html[^>]*class="dark"[^>]*>/, '<html>');
    } else if (isDark && hasDarkVars && !html.includes('class="dark"')) {
      html = html.replace(/<html/, '<html class="dark"');
    }
    html = html.replace(/<link rel="stylesheet" href="theme\.css">/, `<style>\n${cssFile.content}\n</style>`);
    return html;
  }

  const cssContent = cssFile.content;
  const hasDarkVars = /\.dark\s*\{/.test(cssContent) || cssContent.includes('.dark ');

  return `<!DOCTYPE html>
<html${isDark && hasDarkVars ? ' class="dark"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
${cssContent}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--font-sans, system-ui, sans-serif);
  background: var(--background, #fff);
  color: var(--foreground, #333);
  padding: 1.5rem;
  min-height: 100vh;
}
</style>
</head>
<body>
<div style="max-width:100%;margin:0 auto">
  <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
    <span style="background:var(--primary);color:var(--primary-foreground);padding:0.375rem 0.875rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600">Primary</span>
    <span style="background:var(--secondary);color:var(--secondary-foreground);padding:0.375rem 0.875rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600">Secondary</span>
    <span style="background:var(--accent);color:var(--accent-foreground);padding:0.375rem 0.875rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600">Accent</span>
    <span style="background:var(--destructive);color:var(--destructive-foreground);padding:0.375rem 0.875rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600">Destructive</span>
    <span style="background:var(--muted);color:var(--muted-foreground);padding:0.375rem 0.875rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600">Muted</span>
  </div>

  <div style="background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:1rem;box-shadow:0 var(--shadow-offset-y) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)">
    <div style="font-size:1rem;font-weight:700;margin-bottom:0.25rem">Card Title</div>
    <div style="font-size:0.8125rem;color:var(--muted-foreground);margin-bottom:1rem">A card component using the theme variables</div>
    <div style="display:flex;gap:0.5rem">
      <button style="background:var(--primary);color:var(--primary-foreground);border:none;padding:0.5rem 1rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600;cursor:pointer">Button</button>
      <button style="background:transparent;color:var(--foreground);border:1px solid var(--border);padding:0.5rem 1rem;border-radius:var(--radius);font-size:0.8125rem;font-weight:600;cursor:pointer">Outline</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
    <div style="background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius);padding:1rem">
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.25rem">Input</div>
      <div style="background:var(--background);border:1px solid var(--input);border-radius:var(--radius);padding:0.5rem 0.75rem;font-size:0.8125rem;color:var(--foreground)">Text field</div>
    </div>
    <div style="background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:var(--radius);padding:1rem">
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.25rem">Popover</div>
      <div style="font-size:0.8125rem">Popover content area</div>
    </div>
  </div>

  <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem">
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius);background:var(--chart-1)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius);background:var(--chart-2)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius);background:var(--chart-3)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius);background:var(--chart-4)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius);background:var(--chart-5)"></div>
    <span style="font-size:0.6875rem;color:var(--muted-foreground);margin-left:0.5rem">Chart palette</span>
  </div>

  <div style="background:var(--sidebar);color:var(--sidebar-foreground);border:1px solid var(--sidebar-border);border-radius:var(--radius);padding:1rem">
    <div style="display:flex;align-items:center;gap:0.75rem">
      <div style="background:var(--sidebar-primary);color:var(--sidebar-primary-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.75rem;font-weight:600">Active</div>
      <div style="color:var(--sidebar-foreground);font-size:0.75rem">Sidebar item</div>
      <div style="margin-left:auto;background:var(--sidebar-accent);color:var(--sidebar-accent-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.75rem;font-weight:600">Accent</div>
    </div>
    <div style="margin-top:0.5rem;height:2px;background:var(--sidebar-ring);border-radius:1px;width:60%"></div>
  </div>
</div>
</body>
</html>`;
}
