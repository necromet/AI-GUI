# Mode Selector & UI Separation Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mode-selector.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single password gate with a landing selector that routes to three distinct modes: Chat (public), Experiments (password-protected tool workspace), and Combined (chat + experiments split).

**Architecture:** A `currentMode` state in App.tsx drives conditional rendering. A new ModeSelector component serves as the landing page. The Sidebar adapts its content based on mode. Combined mode uses a resizable split panel.

**Tech Stack:** React 19, Vite, Tailwind CDN, lucide-react, TypeScript. No new dependencies.

## Global Constraints

- No npm packages added — use existing Tailwind CDN, lucide-react icons, and vanilla React
- All CSS variables (`--neon-color`, `--bg-*`, `--text-*`, etc.) must work in both dark and light mode
- Password: reuse existing constant `CORRECT_PASSWORD` from PasswordScreen.tsx
- Session key for experiments: `edward:labs_experiments_session` in sessionStorage
- Mode transitions use CSS animations already defined in Tailwind config (fade-in, message-in)
- All existing functionality (streaming, TTS/ASR panels, settings, token stats) must continue working

---

### Task 1: Add Mode Types and State to App.tsx

**Covers:** [S6]

**Files:**
- Modify: `types.ts` — add `Mode` type
- Modify: `App.tsx:49-93` — add mode state, experiments auth state

**Interfaces:**
- Produces: `Mode` type (`'selector' | 'chat' | 'experiments' | 'combined'`), `currentMode` state, `isExperimentsAuthenticated` state

- [ ] **Step 1: Add Mode type to types.ts**

Add after line 60 (after `getModelType`):

```typescript
export type Mode = 'selector' | 'chat' | 'experiments' | 'combined';
```

- [ ] **Step 2: Add mode state to App.tsx**

Import `Mode` from types.ts. Replace the `isAuthenticated` state (line 50-52) and the `activeView` state (line 91) with:

```typescript
const [currentMode, setCurrentMode] = useState<Mode>('selector');
const [isExperimentsAuthenticated, setIsExperimentsAuthenticated] = useState(() => {
  return !!sessionStorage.getItem('edward:labs_experiments_session');
});
const [activeView, setActiveView] = useState<'chat' | 'rag' | 'plugin-agent'>('chat');
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors (warnings about unused variables are OK for now)

---

### Task 2: Create PasswordModal Component

**Covers:** [S5]

**Files:**
- Create: `components/PasswordModal.tsx`

**Interfaces:**
- Produces: `PasswordModal` component with props `{ isOpen: boolean; onSuccess: () => void; onClose: () => void }`

- [ ] **Step 1: Create PasswordModal.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, X } from 'lucide-react';

const CORRECT_PASSWORD = 'thelordismyshepherd';

interface PasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem('edward:labs_experiments_session', 'true');
      onSuccess();
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 p-6 rounded-2xl border animate-fade-in"
        style={{
          backgroundColor: 'var(--bg-200)',
          borderColor: 'var(--border-300)',
          boxShadow: '0 0 40px rgba(var(--neon-rgb), 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-500)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-100)' }}>
            Unlock Experiments
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
            Enter your password to access experimental tools
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-100)',
              border: '1px solid var(--border-300)',
              color: 'var(--text-100)',
            }}
          />

          {error && (
            <p className="text-sm animate-shake" style={{ color: '#f87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--neon-color)',
              color: '#000',
            }}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Unlock
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 3: Create ModeSelector Component

**Covers:** [S4]

**Files:**
- Create: `components/ModeSelector.tsx`

**Interfaces:**
- Consumes: `isExperimentsAuthenticated` boolean
- Produces: `ModeSelector` component with props `{ isExperimentsAuthenticated: boolean; onSelectChat: () => void; onSelectExperiments: () => void; onSelectCombined: () => void; onUnlock: () => void }`

- [ ] **Step 1: Create ModeSelector.tsx**

```tsx
import React, { useState } from 'react';
import { MessageSquare, FlaskConical, Layers, Lock, CheckCircle2 } from 'lucide-react';
import NeuralBackground from './NeuralBackground';
import PasswordModal from './PasswordModal';

interface ModeSelectorProps {
  isExperimentsAuthenticated: boolean;
  onSelectChat: () => void;
  onSelectExperiments: () => void;
  onSelectCombined: () => void;
  onUnlock: () => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function TextGlitch({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);
  const hoverIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    let iteration = 0;
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    hoverIntervalRef.current = setInterval(() => {
      setDisplayText(
        text.split('').map((letter, index) => {
          if (index < iteration) return text[index];
          return LETTERS[Math.floor(Math.random() * 26)];
        }).join('')
      );
      if (iteration >= text.length) {
        if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
      }
      iteration += 1 / 3;
    }, 30);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    setDisplayText(text);
  };

  React.useEffect(() => {
    return () => { if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current); };
  }, []);

  return (
    <h1
      className="text-4xl md:text-5xl font-bold tracking-tight cursor-pointer transition-all duration-500"
      style={{
        backgroundSize: isHovered ? '100%' : '0%',
        backgroundImage: 'linear-gradient(to right, var(--neon-color), var(--neon-color))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'var(--text-100)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
    </h1>
  );
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  isExperimentsAuthenticated,
  onSelectChat,
  onSelectExperiments,
  onSelectCombined,
  onUnlock,
}) => {
  const [neonColor, setNeonColor] = useState('#f87171');
  const [passwordTarget, setPasswordTarget] = useState<'experiments' | 'combined' | null>(null);

  React.useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-color').trim();
    if (color) setNeonColor(color);
  }, []);

  const handleCardClick = (target: 'experiments' | 'combined') => {
    if (isExperimentsAuthenticated) {
      target === 'experiments' ? onSelectExperiments() : onSelectCombined();
    } else {
      setPasswordTarget(target);
    }
  };

  const handlePasswordSuccess = () => {
    onUnlock();
    if (passwordTarget === 'experiments') onSelectExperiments();
    else if (passwordTarget === 'combined') onSelectCombined();
    setPasswordTarget(null);
  };

  const cards = [
    {
      id: 'chat' as const,
      icon: MessageSquare,
      title: 'Chat',
      description: 'AI-powered conversation with MiMo',
      locked: false,
      onClick: onSelectChat,
    },
    {
      id: 'experiments' as const,
      icon: FlaskConical,
      title: 'Experiments',
      description: 'RAG, Plugin Agent, and experimental tools',
      locked: !isExperimentsAuthenticated,
      onClick: () => handleCardClick('experiments'),
    },
    {
      id: 'combined' as const,
      icon: Layers,
      title: 'Combined',
      description: 'Chat supercharged with experiments',
      locked: !isExperimentsAuthenticated,
      onClick: () => handleCardClick('combined'),
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <NeuralBackground className="absolute inset-0 z-0" color={neonColor} trailOpacity={0.12} particleCount={600} speed={0.8} />

      <div className="relative z-10 w-full max-w-4xl mx-4 px-4">
        <div className="text-center mb-12">
          <TextGlitch text="EDWARD:LABS" />
          <p className="text-sm mt-4" style={{ color: 'var(--text-500)' }}>
            AI-powered tools for the curious
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={card.onClick}
              className="group relative p-6 md:p-8 rounded-2xl border text-left transition-all duration-300 animate-fade-in"
              style={{
                backgroundColor: 'rgba(20, 20, 20, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                animationDelay: `${cards.indexOf(card) * 100}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(var(--neon-rgb), 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
                >
                  <card.icon size={24} style={{ color: 'var(--neon-color)' }} />
                </div>
                {card.locked ? (
                  <Lock size={16} style={{ color: 'var(--text-500)' }} />
                ) : card.id !== 'chat' ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--neon-color)' }} />
                ) : null}
              </div>

              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-100)' }}>
                {card.title}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                {card.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <PasswordModal
        isOpen={passwordTarget !== null}
        onSuccess={handlePasswordSuccess}
        onClose={() => setPasswordTarget(null)}
      />
    </div>
  );
};

export default ModeSelector;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 4: Wire ModeSelector into App.tsx, Remove Old Password Gate

**Covers:** [S6, S1]

**Files:**
- Modify: `App.tsx:705-707` — remove PasswordScreen gate, add ModeSelector gate
- Modify: `App.tsx` imports — replace PasswordScreen with ModeSelector

**Interfaces:**
- Consumes: `currentMode`, `isExperimentsAuthenticated` state from Task 1; `ModeSelector` from Task 3

- [ ] **Step 1: Update imports in App.tsx**

Remove the `PasswordScreen` import. Add:
```typescript
import ModeSelector from './components/ModeSelector';
```

- [ ] **Step 2: Replace the authentication gate**

Replace the block at lines 705-707:
```tsx
if (!isAuthenticated) {
  return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />;
}
```

With:
```tsx
if (currentMode === 'selector') {
  return (
    <ModeSelector
      isExperimentsAuthenticated={isExperimentsAuthenticated}
      onSelectChat={() => setCurrentMode('chat')}
      onSelectExperiments={() => setCurrentMode('experiments')}
      onSelectCombined={() => setCurrentMode('combined')}
      onUnlock={() => {
        setIsExperimentsAuthenticated(true);
        sessionStorage.setItem('edward:labs_experiments_session', 'true');
      }}
    />
  );
}
```

- [ ] **Step 3: Remove unused isAuthenticated state and PasswordScreen import**

Delete the `isAuthenticated` state declaration (line 50-52) and the `PasswordScreen` import (line 13).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 5: Adapt Sidebar for Mode Awareness

**Covers:** [S7]

**Files:**
- Modify: `components/Sidebar.tsx` — accept `currentMode` prop, conditionally render content

**Interfaces:**
- Consumes: `currentMode` (Mode type), `isExperimentsAuthenticated` boolean
- Produces: Updated Sidebar with mode-conditional rendering, `onBackToSelector` callback

- [ ] **Step 1: Update Sidebar props**

Add to SidebarProps interface:
```typescript
currentMode: 'chat' | 'experiments' | 'combined';
onBackToSelector: () => void;
isExperimentsAuthenticated?: boolean;
```

- [ ] **Step 2: Conditionally render sidebar content**

In the Sidebar component body, wrap the content sections:

For `currentMode === 'experiments'`:
- Hide the "New chat" button
- Hide the conversation history section
- Show tool navigation (RAG, Plugin Agent) as the main nav
- Add "Back to selector" button at the top (below logo)

For `currentMode === 'chat'` or `'combined'`:
- Show standard sidebar (current behavior)
- Remove the "Experiment" section (RAG/Plugin Agent nav)
- Add "Back to selector" button in the footer (above Settings)

- [ ] **Step 3: Add mode badge to sidebar header**

Below the logo in the sidebar header, add a small pill-shaped badge:
```tsx
<span
  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
  style={{
    backgroundColor: currentMode === 'chat' ? 'rgba(var(--neon-rgb), 0.1)' : 'rgba(var(--neon-rgb), 0.15)',
    color: 'var(--neon-color)',
  }}
>
  {currentMode === 'chat' ? 'Chat' : currentMode === 'experiments' ? 'Lab' : 'Combined'}
</span>
```

- [ ] **Step 4: Update App.tsx to pass new props to Sidebar**

In the `<Sidebar>` usage in App.tsx, add:
```tsx
currentMode={currentMode}
onBackToSelector={() => setCurrentMode('selector')}
isExperimentsAuthenticated={isExperimentsAuthenticated}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 6: Implement Experiments Mode Layout

**Covers:** [S3]

**Files:**
- Modify: `App.tsx` — add experiments mode rendering in the content area
- Modify: `components/Sidebar.tsx` — experiment tool navigation

**Interfaces:**
- Consumes: `currentMode`, `activeView` state
- Produces: Experiments mode showing RAGPanel or PluginAgentPanel based on sidebar selection

- [ ] **Step 1: Add experiments mode rendering in App.tsx content area**

In the content area (around line 786), add a condition for experiments mode:

```tsx
{currentMode === 'experiments' ? (
  <div className="h-full flex items-center justify-center p-6">
    {activeView === 'rag' ? (
      <RAGPanel theme={theme} />
    ) : activeView === 'plugin-agent' ? (
      <PluginAgentPanel theme={theme} />
    ) : (
      <RAGPanel theme={theme} />
    )}
  </div>
) : /* existing chat/combined rendering */ ...}
```

- [ ] **Step 2: Hide chat input in experiments mode**

The input area (line 856) should check `currentMode !== 'experiments'` in addition to the existing `modelType === 'chat'` check:

```tsx
{modelType === 'chat' && activeView === 'chat' && currentMode !== 'experiments' && (
```

- [ ] **Step 3: Default activeView to 'rag' in experiments mode**

Add an effect that sets `activeView` to `'rag'` when entering experiments mode:

```tsx
useEffect(() => {
  if (currentMode === 'experiments') {
    setActiveView('rag');
  }
}, [currentMode]);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 7: Create ResizableDivider Component

**Covers:** [S3]

**Files:**
- Create: `components/ResizableDivider.tsx`

**Interfaces:**
- Produces: `ResizableDivider` with props `{ onResize: (leftPercent: number) => void; onCollapse: () => void; isCollapsed: boolean }`

- [ ] **Step 1: Create ResizableDivider.tsx**

```tsx
import React, { useCallback, useRef } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';

interface ResizableDividerProps {
  onResize: (leftPercent: number) => void;
  onCollapse: () => void;
  isCollapsed: boolean;
}

const ResizableDivider: React.FC<ResizableDividerProps> = ({ onResize, onCollapse, isCollapsed }) => {
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(percent, 30), 70);
      onResize(clamped);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  const handleDoubleClick = useCallback(() => {
    onResize(50);
  }, [onResize]);

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0 flex items-center justify-center group"
      style={{ width: '12px', cursor: 'col-resize' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute inset-y-0 w-px transition-colors duration-200"
        style={{
          backgroundColor: 'var(--border-300)',
        }}
      />
      <div
        className="absolute inset-y-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          backgroundColor: 'rgba(var(--neon-rgb), 0.3)',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="relative z-10 flex items-center justify-center w-6 h-10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundColor: 'var(--bg-300)' }}
      >
        <GripVertical size={12} style={{ color: 'var(--text-500)' }} />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onCollapse(); }}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
        style={{
          backgroundColor: 'var(--bg-300)',
          color: 'var(--text-500)',
        }}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <ChevronRight
          size={12}
          style={{
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
    </div>
  );
};

export default ResizableDivider;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 8: Implement Combined Mode Layout

**Covers:** [S3]

**Files:**
- Modify: `App.tsx` — add combined mode split layout rendering

**Interfaces:**
- Consumes: `currentMode`, `ResizableDivider` from Task 7, existing chat and experiment components
- Produces: Side-by-side split layout with chat on left, experiment drawer on right

- [ ] **Step 1: Add split state to App.tsx**

```typescript
const [splitPercent, setSplitPercent] = useState(60);
const [isExperimentPanelCollapsed, setIsExperimentPanelCollapsed] = useState(false);
const [experimentActiveTab, setExperimentActiveTab] = useState<'rag' | 'plugin-agent'>('rag');
```

- [ ] **Step 2: Add combined mode rendering in content area**

Replace the content area rendering to handle combined mode. The combined mode shows a split layout:

```tsx
{currentMode === 'combined' ? (
  <div className="flex-1 flex h-full overflow-hidden">
    {/* Left: Chat */}
    <div
      className="flex-1 flex flex-col min-w-0 overflow-hidden"
      style={{ width: isExperimentPanelCollapsed ? '100%' : `${splitPercent}%` }}
    >
      {/* Chat content (messages + input) — same as chat mode rendering */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth" id="scroll-container">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${patternBg})`, backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 0.3, filter: 'grayscale(1)' }} />
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
            <div className="relative mb-8">
              <div className="scale-150" style={{ color: 'var(--text-300)' }}>{CHATGPT_LOGO}</div>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-8" style={{ color: 'var(--text-100)' }}>
              How can I help you today?
            </h2>
          </div>
        ) : (
          <div className="pb-10 mb-52">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onRegenerate={handleRegenerate} onFeedback={handleFeedback} onReattach={handleReattach} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* Input area */}
      <div className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-4" style={{ background: `linear-gradient(to top, var(--bg-100) 50%, transparent)` }}>
        <div className="max-w-3xl mx-auto w-full">
          <PromptInputBox onSend={handleSendMessage} isLoading={isStreaming} onStop={handleStopGeneration} placeholder="Message edward:labs..." theme={theme} externalFiles={pendingFiles} onExternalFilesConsumed={() => setPendingFiles([])} />
        </div>
      </div>
    </div>

    {/* Divider */}
    {!isExperimentPanelCollapsed && (
      <ResizableDivider
        onResize={setSplitPercent}
        onCollapse={() => setIsExperimentPanelCollapsed(true)}
        isCollapsed={isExperimentPanelCollapsed}
      />
    )}

    {/* Right: Experiment Drawer */}
    {!isExperimentPanelCollapsed && (
      <div
        className="flex flex-col min-w-0 overflow-hidden border-l"
        style={{
          width: `${100 - splitPercent}%`,
          borderColor: 'var(--border-300)',
          backgroundColor: 'var(--bg-200)',
        }}
      >
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
          {[
            { id: 'rag' as const, label: 'RAG' },
            { id: 'plugin-agent' as const, label: 'Plugin Agent' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setExperimentActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                backgroundColor: experimentActiveTab === tab.id ? 'var(--bg-300)' : 'transparent',
                color: experimentActiveTab === tab.id ? 'var(--text-100)' : 'var(--text-500)',
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setIsExperimentPanelCollapsed(true)}
            className="ml-auto p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-500)' }}
            title="Collapse panel"
          >
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>

        {/* Tool content */}
        <div className="flex-1 overflow-y-auto p-4">
          {experimentActiveTab === 'rag' ? (
            <RAGPanel theme={theme} />
          ) : (
            <PluginAgentPanel theme={theme} />
          )}
        </div>
      </div>
    )}

    {/* Expand button when collapsed */}
    {isExperimentPanelCollapsed && (
      <button
        onClick={() => setIsExperimentPanelCollapsed(false)}
        className="fixed bottom-6 right-6 z-20 p-3 rounded-full shadow-lg transition-all duration-200"
        style={{
          backgroundColor: 'var(--neon-color)',
          color: '#000',
        }}
        title="Open experiments panel"
      >
        <FlaskConical size={20} />
      </button>
    )}
  </div>
) : /* existing chat-only rendering */ ...}
```

- [ ] **Step 3: Import FlaskConical and ChevronRight in App.tsx**

Add to the lucide-react import:
```typescript
import { PanelLeft, SquarePen, FlaskConical, ChevronRight } from 'lucide-react';
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 9: Add Back-to-Selector Navigation

**Covers:** [S7]

**Files:**
- Modify: `App.tsx` — handle mode transitions and back navigation

**Interfaces:**
- Consumes: `currentMode`, `setCurrentMode`

- [ ] **Step 1: Add back-to-selector handler**

```typescript
const handleBackToSelector = () => {
  setCurrentMode('selector');
};
```

- [ ] **Step 2: Pass to Sidebar and wire up**

Ensure the Sidebar receives `onBackToSelector={handleBackToSelector}` and renders the button in the footer.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 10: Wire Everything Together and Final Integration

**Covers:** [S3, S6, S7]

**Files:**
- Modify: `App.tsx` — final integration of all mode rendering paths
- Modify: `components/Sidebar.tsx` — final sidebar mode switching

**Interfaces:**
- All components from previous tasks

- [ ] **Step 1: Restructure the main content rendering in App.tsx**

The content area should have this top-level structure:

```tsx
{currentMode === 'experiments' ? (
  /* Experiments mode: tool-focused sidebar + full-width tool panel */
  <div className="flex h-screen overflow-hidden">
    <Sidebar ... currentMode={currentMode} onBackToSelector={handleBackToSelector} />
    <main className="flex-1 flex flex-col h-full relative min-w-0">
      {/* Experiments content — RAGPanel or PluginAgentPanel based on activeView */}
    </main>
  </div>
) : currentMode === 'combined' ? (
  /* Combined mode: chat sidebar + split layout */
  <div className="flex h-screen overflow-hidden">
    <Sidebar ... currentMode={currentMode} onBackToSelector={handleBackToSelector} />
    <main className="flex-1 flex flex-col h-full relative min-w-0">
      {/* Split layout from Task 8 */}
    </main>
  </div>
) : (
  /* Chat mode: standard layout (current app structure) */
  <div className="flex h-screen overflow-hidden">
    <Sidebar ... currentMode={currentMode} onBackToSelector={handleBackToSelector} />
    <main className="flex-1 flex flex-col h-full relative min-w-0">
      {/* Current chat rendering */}
    </main>
  </div>
)}
```

- [ ] **Step 2: Verify all mode transitions work**

Test by running: `npm run dev`
- Open browser to localhost:5173
- Verify: Landing selector appears with 3 cards
- Click Chat → enters chat mode
- Click back → returns to selector
- Click Experiments → password modal appears
- Enter correct password → enters experiments mode
- Navigate back → selector (experiments now unlocked)
- Click Combined → enters combined mode directly (already authenticated)

- [ ] **Step 3: Run final build check**

Run: `npm run build`
Expected: Build succeeds with no errors

---

### Task 11: Visual Polish and Animations

**Covers:** [S8]

**Files:**
- Modify: `components/ModeSelector.tsx` — transition animations
- Modify: `App.tsx` — mode transition animations

**Interfaces:**
- CSS animations from Tailwind config (fade-in, message-in)

- [ ] **Step 1: Add mode transition wrapper in App.tsx**

Wrap the mode rendering in a transition container:

```tsx
<div className="animate-fade-in" key={currentMode}>
  {/* mode content */}
</div>
```

- [ ] **Step 2: Add staggered card animation in ModeSelector**

Each card already has `animationDelay` set. Verify the `animate-fade-in` class works with the delay by adding `animation-fill-mode: forwards` to the cards' style:

```tsx
style={{
  opacity: 0,
  animationFillMode: 'forwards',
}}
```

- [ ] **Step 3: Verify visual transitions**

Run: `npm run dev`
- Check that card hover effects (lift, glow) work
- Check that mode transitions feel smooth
- Check dark/light mode toggle works in all modes

- [ ] **Step 4: Final build check**

Run: `npm run build`
Expected: Build succeeds
