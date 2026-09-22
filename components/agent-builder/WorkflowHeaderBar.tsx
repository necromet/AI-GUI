import type { ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, BookmarkPlus, CheckCircle2, Code, Download,
  Eye, FileCode2, Globe2, Keyboard, LayoutDashboard, Maximize2, Network,
  Redo2, Save, Share2, SlidersHorizontal, Undo2, Upload,
} from 'lucide-react';
import { SEMANTIC_COLORS } from './shared/colors';
import type { WorkflowHeaderControls } from './types';
import { ThemedTooltip, ThemedTooltipContent, ThemedTooltipProvider, ThemedTooltipTrigger } from './shared/ThemedTooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function HeaderTip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <ThemedTooltip>
      <ThemedTooltipTrigger asChild>{children}</ThemedTooltipTrigger>
      <ThemedTooltipContent side="bottom" sideOffset={8} className="flex items-center gap-2 rounded-lg px-2.5 py-2">
        <span>{label}</span>
        {shortcut && <kbd className="rounded px-1.5 py-0.5 text-[9px] font-mono" style={{ color: 'var(--text-500)', background: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>{shortcut}</kbd>}
      </ThemedTooltipContent>
    </ThemedTooltip>
  );
}

function IconButton({ label, shortcut, onClick, disabled, active, children }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <HeaderTip label={label} shortcut={shortcut}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="h-8 w-8 flex items-center justify-center rounded-[10px] cursor-pointer disabled:cursor-default disabled:opacity-35 transition-all duration-150 hover:-translate-y-px hover:bg-[var(--bg-300)]"
        style={{ color: active ? 'var(--neon-color)' : 'var(--text-400)', backgroundColor: active ? 'rgba(var(--neon-rgb),.1)' : undefined }}
      >
        {children}
      </button>
    </HeaderTip>
  );
}

export default function WorkflowHeaderBar({ controls: w }: { controls: WorkflowHeaderControls }) {
  const errors = w.validationIssues.filter((issue: any) => issue.severity === 'error');
  const warnings = w.validationIssues.filter((issue: any) => issue.severity === 'warning');
  const groupStyle = { background: 'color-mix(in srgb, var(--bg-200) 72%, transparent)', border: '1px solid var(--border-300)' };

  return (
    <ThemedTooltipProvider delayDuration={240}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {w.onBack && <IconButton label="Back to workflows" onClick={w.onBack}><ArrowLeft size={15} /></IconButton>}

        <div className="h-9 min-w-[150px] max-w-[240px] flex items-center px-3 rounded-xl" style={groupStyle}>
          <span className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0" style={{ background: 'var(--neon-color)', boxShadow: '0 0 8px rgba(var(--neon-rgb),.55)' }} />
          <input value={w.name} onChange={event => w.onNameChange(event.target.value)} className="min-w-0 w-full text-sm font-semibold bg-transparent border-none outline-none" style={{ color: 'var(--text-100)' }} placeholder="Workflow name" />
        </div>

        <div className="flex items-center p-0.5 rounded-xl" style={groupStyle}>
          <IconButton label="Undo" shortcut="Ctrl Z" onClick={w.onUndo} disabled={!w.canUndo}><Undo2 size={14} /></IconButton>
          <IconButton label="Redo" shortcut="Ctrl ⇧ Z" onClick={w.onRedo} disabled={!w.canRedo}><Redo2 size={14} /></IconButton>
          <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-300)' }} />
          <IconButton label="Fit workflow to view" shortcut="F" onClick={w.onFitView}><Maximize2 size={14} /></IconButton>
          <IconButton label="Auto-arrange workflow" onClick={w.onAutoLayout}><LayoutDashboard size={14} /></IconButton>
          <IconButton label="Keyboard shortcuts" shortcut="?" onClick={w.onShowShortcuts}><Keyboard size={15} /></IconButton>
        </div>

        {w.validationIssues.length > 0 ? (
          <div className="relative">
            <HeaderTip label={`${errors.length} errors, ${warnings.length} warnings`}>
              <button onClick={() => w.setShowValidation(!w.showValidation)} className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer" style={{ color: errors.length ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning, background: errors.length ? 'rgba(248,113,113,.14)' : 'rgba(251,191,36,.14)', border: `1px solid ${errors.length ? 'rgba(248,113,113,.32)' : 'rgba(251,191,36,.32)'}` }}><AlertTriangle size={14} /><span className="text-[10px] font-semibold">{w.validationIssues.length}</span></button>
            </HeaderTip>
            {w.showValidation && (
              <div className="absolute top-full left-0 mt-2 w-[310px] rounded-2xl border shadow-2xl z-50 overflow-hidden" style={{ borderColor: 'var(--border-300)', background: 'color-mix(in srgb, var(--bg-100) 96%, transparent)', backdropFilter: 'blur(18px)' }}>
                <div className="px-3 py-2.5 text-[11px] font-semibold border-b" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>Workflow validation</div>
                <div className="max-h-64 overflow-y-auto p-1.5">{w.validationIssues.map((issue: any, index: number) => <button key={`${issue.nodeId || 'workflow'}-${index}`} onClick={() => { w.onFocusIssue(issue.nodeId); w.setShowValidation(false); }} className="w-full flex gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer hover:bg-[var(--bg-200)]"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: issue.severity === 'error' ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning }} /><span className="text-[10px] leading-relaxed" style={{ color: 'var(--text-300)' }}>{issue.message}</span></button>)}</div>
              </div>
            )}
          </div>
        ) : w.nodes.length > 0 ? <HeaderTip label="Workflow is valid"><div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ color: SEMANTIC_COLORS.success, background: 'rgba(52,211,153,.14)', border: '1px solid rgba(52,211,153,.32)' }}><CheckCircle2 size={14} /></div></HeaderTip> : null}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center p-0.5 rounded-xl" style={groupStyle}>
          {w.onLoadTemplate && <IconButton label="Browse templates" onClick={w.onLoadTemplate}><FileCode2 size={14} /></IconButton>}
          {w.workflowId && w.nodes.length > 0 && <IconButton label="Save as template" onClick={() => w.setShowSaveAsTemplate(true)}><BookmarkPlus size={14} /></IconButton>}
          <IconButton label="Import workflow" onClick={w.handleImport}><Upload size={14} /></IconButton>
          <IconButton label="Preview workflow" onClick={w.handlePreview}><Eye size={14} /></IconButton>
          <IconButton label="Builder settings" onClick={w.handleSettings}><SlidersHorizontal size={14} /></IconButton>
        </div>

        <Popover>
          <HeaderTip label="Export and share">
            <PopoverTrigger asChild><button className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all hover:-translate-y-px" style={{ color: 'var(--text-300)', ...groupStyle }}><Download size={14} />Export</button></PopoverTrigger>
          </HeaderTip>
          <PopoverContent align="end" sideOffset={8} className="w-56 p-1.5 rounded-2xl" style={{ background: 'color-mix(in srgb, var(--bg-100) 96%, transparent)', borderColor: 'var(--border-300)', backdropFilter: 'blur(18px)' }}>
            <ExportAction icon={<Download size={13} />} label="Workflow JSON" onClick={w.handleExport} />
            {w.workflowId && <ExportAction icon={<Code size={13} />} label="LangGraph code" onClick={w.handleExportCode} />}
            {w.workflowId && <ExportAction icon={<Network size={13} />} label="Copy Mermaid" onClick={w.handleExportMermaid} />}
            <ExportAction icon={<Share2 size={13} />} label="Download workflow" onClick={w.handleShare} />
          </PopoverContent>
        </Popover>

        {w.workflowId && <IconButton label="Publish workflow API" onClick={() => w.setShowPublish(true)}><Globe2 size={15} /></IconButton>}
        <HeaderTip label="Save workflow" shortcut="Ctrl S">
          <button onClick={w.handleSave} disabled={w.saving} className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-px" style={{ color: '#050505', background: 'var(--neon-color)', boxShadow: '0 8px 22px rgba(var(--neon-rgb),.2)' }}><Save size={14} />{w.saving ? 'Saving…' : 'Save'}</button>
        </HeaderTip>
      </div>
    </ThemedTooltipProvider>
  );
}

function ExportAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left cursor-pointer hover:bg-[var(--bg-200)]" style={{ color: 'var(--text-300)' }}><span style={{ color: 'var(--text-500)' }}>{icon}</span>{label}</button>;
}
