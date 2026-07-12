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

export const CONTENT_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
];

export const FILENAME_MAP: Record<string, string> = {
  html: 'index.html', tsx: 'Component.tsx', css: 'style.css', js: 'script.js', ts: 'script.ts', json: 'data.json', markdown: 'README.md',
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
<title>Theme Preview</title>
<link rel="stylesheet" href="theme.css">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-sans); background: var(--background); color: var(--foreground); min-height: 100vh; display: flex; }
a { color: inherit; text-decoration: none; }

/* Sidebar */
.sidebar {
  width: 240px; min-height: 100vh; background: var(--sidebar);
  border-right: 1px solid var(--sidebar-border); padding: 1rem;
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar-logo { font-size: 1rem; font-weight: 700; color: var(--sidebar-foreground); padding: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
.sidebar-logo svg { width: 20px; height: 20px; color: var(--sidebar-primary); }
.sidebar-section { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); padding: 0.5rem 0.5rem 0.25rem; }
.sidebar-item {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;
  border-radius: var(--radius); font-size: 0.8125rem; color: var(--sidebar-foreground);
  cursor: pointer; transition: background 0.15s;
}
.sidebar-item:hover { background: var(--sidebar-accent); color: var(--sidebar-accent-foreground); }
.sidebar-item.active { background: var(--sidebar-primary); color: var(--sidebar-primary-foreground); font-weight: 600; }
.sidebar-item svg { width: 16px; height: 16px; opacity: 0.7; }
.sidebar-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--sidebar-border); }
.sidebar-user { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; }
.sidebar-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--sidebar-primary); display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; color: var(--sidebar-primary-foreground); }

/* Main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--card); }
.topbar-title { font-size: 0.9375rem; font-weight: 700; }
.topbar-actions { display: flex; align-items: center; gap: 0.5rem; }
.content { flex: 1; padding: 1.5rem; overflow-y: auto; }

/* Cards */
.card {
  background: var(--card); color: var(--card-foreground); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem;
  box-shadow: 0 var(--shadow-offset-y) var(--shadow-blur) var(--shadow-spread) var(--shadow-color);
}
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.card-title { font-size: 0.8125rem; font-weight: 600; color: var(--muted-foreground); }
.card-value { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; }
.card-change { font-size: 0.6875rem; color: var(--chart-3); font-weight: 600; }
.card-change.down { color: var(--destructive); }
.card-desc { font-size: 0.75rem; color: var(--muted-foreground); margin-top: 0.25rem; }

/* Grid */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem;
  border-radius: var(--radius); font-size: 0.8125rem; font-weight: 600;
  border: none; cursor: pointer; transition: opacity 0.15s;
}
.btn:hover { opacity: 0.9; }
.btn-primary { background: var(--primary); color: var(--primary-foreground); }
.btn-secondary { background: var(--secondary); color: var(--secondary-foreground); }
.btn-outline { background: transparent; color: var(--foreground); border: 1px solid var(--border); }
.btn-destructive { background: var(--destructive); color: var(--destructive-foreground); }
.btn-ghost { background: transparent; color: var(--foreground); }
.btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
.btn-icon { padding: 0.5rem; }

/* Input */
.input {
  width: 100%; padding: 0.5rem 0.75rem; background: var(--background);
  border: 1px solid var(--input); border-radius: var(--radius);
  font-size: 0.8125rem; color: var(--foreground); outline: none;
}
.input:focus { border-color: var(--ring); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent); }
.input::placeholder { color: var(--muted-foreground); opacity: 0.6; }

/* Badge */
.badge {
  display: inline-flex; padding: 0.125rem 0.5rem; border-radius: 9999px;
  font-size: 0.6875rem; font-weight: 600; line-height: 1.5;
}
.badge-primary { background: var(--primary); color: var(--primary-foreground); }
.badge-secondary { background: var(--secondary); color: var(--secondary-foreground); }
.badge-accent { background: var(--accent); color: var(--accent-foreground); }
.badge-destructive { background: var(--destructive); color: var(--destructive-foreground); }
.badge-outline { background: transparent; color: var(--foreground); border: 1px solid var(--border); }

/* Table */
.table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.table th { text-align: left; padding: 0.625rem 0.75rem; font-size: 0.6875rem; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); }
.table td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); }
.table tr:last-child td { border-bottom: none; }
.table-row:hover { background: var(--muted); }

/* Avatar */
.avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; flex-shrink: 0; }

/* Progress */
.progress-track { width: 100%; height: 6px; background: var(--secondary); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }

/* Tabs */
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
.tab { padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 500; color: var(--muted-foreground); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab:hover { color: var(--foreground); }
.tab.active { color: var(--foreground); border-bottom-color: var(--primary); font-weight: 600; }

/* Toggle */
.toggle { position: relative; width: 36px; height: 20px; background: var(--input); border-radius: 10px; cursor: pointer; transition: background 0.2s; }
.toggle.on { background: var(--primary); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: transform 0.2s; }
.toggle.on::after { transform: translateX(16px); }

/* Chart bars */
.chart-bars { display: flex; align-items: flex-end; gap: 0.375rem; height: 80px; }
.chart-bar { flex: 1; border-radius: 3px 3px 0 0; min-width: 12px; transition: height 0.3s; }

/* Separator */
.separator { height: 1px; background: var(--border); margin: 1rem 0; }
</style>
</head>
<body>

<!-- Sidebar -->
<nav class="sidebar">
  <div class="sidebar-logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
    Dashboard
  </div>
  <div class="sidebar-section">Platform</div>
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

<!-- Main Content -->
<div class="main">
  <div class="topbar">
    <div class="topbar-title">Overview</div>
    <div class="topbar-actions">
      <input class="input" style="width:220px" placeholder="Search..." />
      <button class="btn btn-primary btn-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Project
      </button>
    </div>
  </div>

  <div class="content">
    <!-- Tabs -->
    <div class="tabs">
      <div class="tab active">Overview</div>
      <div class="tab">Analytics</div>
      <div class="tab">Reports</div>
      <div class="tab">Notifications</div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Total Revenue</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="card-value">$45,231</div>
        <div class="card-change">+20.1% from last month</div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Subscriptions</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div class="card-value">+2,350</div>
        <div class="card-change">+180.1% from last month</div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Active Now</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="card-value">+573</div>
        <div class="card-change">+19% from last hour</div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Conversion</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div class="card-value">3.2%</div>
        <div class="card-change down">-0.4% from last week</div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="two-col">
      <!-- Recent Sales -->
      <div class="card">
        <div class="card-header">
          <div>
            <div style="font-size:1rem;font-weight:700">Recent Sales</div>
            <div class="card-desc">You made 265 sales this month.</div>
          </div>
          <button class="btn btn-outline btn-sm">View All</button>
        </div>
        <table class="table">
          <thead>
            <tr><th>Customer</th><th>Email</th><th>Status</th><th style="text-align:right">Amount</th></tr>
          </thead>
          <tbody>
            <tr class="table-row">
              <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--primary);color:var(--primary-foreground)">OM</div> Olivia Martin</div></td>
              <td style="color:var(--muted-foreground)">olivia@email.com</td>
              <td><span class="badge badge-primary">Paid</span></td>
              <td style="text-align:right;font-weight:600">$1,999.00</td>
            </tr>
            <tr class="table-row">
              <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--accent);color:var(--accent-foreground)">JL</div> Jackson Lee</div></td>
              <td style="color:var(--muted-foreground)">jackson@email.com</td>
              <td><span class="badge badge-primary">Paid</span></td>
              <td style="text-align:right;font-weight:600">$39.00</td>
            </tr>
            <tr class="table-row">
              <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--secondary);color:var(--secondary-foreground)">IN</div> Isabella Nguyen</div></td>
              <td style="color:var(--muted-foreground)">isabella@email.com</td>
              <td><span class="badge badge-secondary">Pending</span></td>
              <td style="text-align:right;font-weight:600">$299.00</td>
            </tr>
            <tr class="table-row">
              <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--destructive);color:var(--destructive-foreground)">WK</div> William Kim</div></td>
              <td style="color:var(--muted-foreground)">will@email.com</td>
              <td><span class="badge badge-destructive">Failed</span></td>
              <td style="text-align:right;font-weight:600">$99.00</td>
            </tr>
            <tr class="table-row">
              <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="avatar" style="background:var(--chart-3);color:#fff">SD</div> Sofia Davis</div></td>
              <td style="color:var(--muted-foreground)">sofia@email.com</td>
              <td><span class="badge badge-primary">Paid</span></td>
              <td style="text-align:right;font-weight:600">$599.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Right Column -->
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Buttons Card -->
        <div class="card">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Buttons</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
            <button class="btn btn-primary btn-sm">Primary</button>
            <button class="btn btn-secondary btn-sm">Secondary</button>
            <button class="btn btn-outline btn-sm">Outline</button>
            <button class="btn btn-destructive btn-sm">Destructive</button>
            <button class="btn btn-ghost btn-sm">Ghost</button>
          </div>
        </div>

        <!-- Badges Card -->
        <div class="card">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Badges</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.375rem">
            <span class="badge badge-primary">Primary</span>
            <span class="badge badge-secondary">Secondary</span>
            <span class="badge badge-accent">Accent</span>
            <span class="badge badge-destructive">Destructive</span>
            <span class="badge badge-outline">Outline</span>
          </div>
        </div>

        <!-- Chart Card -->
        <div class="card">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Weekly Activity</div>
          <div class="chart-bars">
            <div class="chart-bar" style="height:40%;background:var(--chart-1)"></div>
            <div class="chart-bar" style="height:65%;background:var(--chart-1)"></div>
            <div class="chart-bar" style="height:45%;background:var(--chart-1)"></div>
            <div class="chart-bar" style="height:80%;background:var(--chart-1)"></div>
            <div class="chart-bar" style="height:55%;background:var(--chart-1)"></div>
            <div class="chart-bar" style="height:90%;background:var(--chart-2)"></div>
            <div class="chart-bar" style="height:70%;background:var(--chart-1)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.5rem;font-size:0.625rem;color:var(--muted-foreground)">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        <!-- Progress Card -->
        <div class="card">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Storage Used</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5rem">
            <span style="font-size:1.25rem;font-weight:700">4.2 GB</span>
            <span style="font-size:0.6875rem;color:var(--muted-foreground)">of 10 GB</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:42%;background:var(--primary)"></div>
          </div>
        </div>

        <!-- Toggle Card -->
        <div class="card">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Settings</div>
          <div style="display:flex;flex-direction:column;gap:0.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.8125rem">Dark Mode</span>
              <div class="toggle on"></div>
            </div>
            <div class="separator"></div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.8125rem">Notifications</span>
              <div class="toggle on"></div>
            </div>
            <div class="separator"></div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.8125rem">Marketing Emails</span>
              <div class="toggle"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Color Palette -->
    <div class="card" style="margin-bottom:1.5rem">
      <div style="font-size:0.8125rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.75rem">Color Palette</div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--primary);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Primary</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--secondary);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Secondary</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--accent);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Accent</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--destructive);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Destructive</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--muted);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Muted</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--card);border:1px solid var(--border);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Card</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--popover);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Popover</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--background);border:1px solid var(--border);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Background</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--sidebar);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Sidebar</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--border);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Border</span></div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--chart-1);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Chart 1</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--chart-2);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Chart 2</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--chart-3);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Chart 3</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--chart-4);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Chart 4</span></div>
        <div style="text-align:center"><div style="width:48px;height:48px;border-radius:var(--radius);background:var(--chart-5);margin-bottom:0.25rem"></div><span style="font-size:0.5625rem;color:var(--muted-foreground)">Chart 5</span></div>
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
