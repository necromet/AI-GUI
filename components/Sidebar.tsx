import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, BarChart3, Sun, Moon, Database, Puzzle, Home, Layers, Package, ArrowLeft } from 'lucide-react';
import { ChatSession, Mode, ConversationType, ModelConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import SidebarSettingsPanel from './SidebarSettingsPanel';
import SidebarTokenStatsPanel from './SidebarTokenStatsPanel';

export type SidebarPanel = 'none' | 'settings' | 'token-stats';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenTokenStats?: () => void;
  conversations: ChatSession[];
  currentConversationId: number | null;
  onSelectConversation: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentModelName?: string;
  sidebarPanel: SidebarPanel;
  onSidebarPanelChange: (panel: SidebarPanel) => void;
  settingsProps: {
    neonColor: string;
    onChangeNeonColor: (color: string) => void;
    neonPreset: string;
    onChangeNeonPreset: (preset: string) => void;
    models: ModelConfig[];
    onAddModel: (model: ModelConfig) => void;
    onDeleteModel: (id: string) => void;
    defaultModelId: string;
    onChangeDefaultModel: (id: string) => void;
    maxOutputTokens: number | undefined;
    onChangeMaxOutputTokens: (value: number | undefined) => void;
    fontSize: string;
    onChangeFontSize: (size: string) => void;
    fontFamily: string;
    onChangeFontFamily: (family: string) => void;
  };
  availableModels: ModelConfig[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNewChat,
  onOpenSettings,
  onOpenTokenStats,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  theme,
  onToggleTheme,
  currentModelName,
  sidebarPanel,
  onSidebarPanelChange,
  settingsProps,
  availableModels,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isChatMode = location.pathname.startsWith('/chat');
  const isLibraryMode = location.pathname.startsWith('/library');
  const currentMode: Mode = isChatMode ? 'chat' : isLibraryMode ? 'library' : 'experiments';
  const activeView: 'chat' | 'rag' | 'plugin-agent' | 'stitch' = (() => {
    if (isChatMode) return 'chat';
    if (location.pathname.includes('/plugin-agent')) return 'plugin-agent';
    if (location.pathname.includes('/stitch')) return 'stitch';
    return 'rag';
  })();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const todayConvos = conversations.filter(c => c.updatedAt >= today.getTime());
  const yesterdayConvos = conversations.filter(c => c.updatedAt >= yesterday.getTime() && c.updatedAt < today.getTime());
  const lastWeekConvos = conversations.filter(c => c.updatedAt >= lastWeek.getTime() && c.updatedAt < yesterday.getTime());
  const olderConvos = conversations.filter(c => c.updatedAt < lastWeek.getTime());

  const itemClassName = (isActive: boolean) =>
    `w-full text-left flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 truncate ${
      isActive
        ? 'bg-[var(--bg-300)] text-[var(--text-100)]'
        : 'text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)]'
    }`;

  const sidebarItemClassName =
    'w-full justify-start gap-3 px-3 py-2 h-auto rounded-lg text-sm font-medium text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)] transition-all duration-150';

  const renderConversation = (conv: ChatSession) => {
    const isActive = conv.dbConversationId === currentConversationId;
    return (
      <li key={conv.id}>
        <div
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className={`${itemClassName(isActive)} group cursor-pointer relative`}
        >
          <span className="truncate flex-1">
            {conv.title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-[var(--text-500)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </li>
    );
  };

  const sectionLabel = (text: string) => (
    <div className="px-3 pt-4 pb-2">
      <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-500)]">
        {text}
      </span>
    </div>
  );

  const modeBadge = (
    <Badge
      variant="outline"
      className="text-xs font-medium border-0 px-2 py-0.5"
      style={{
        backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
        color: 'var(--neon-color)',
      }}
    >
      {currentMode === 'chat' ? 'Chat' : currentMode === 'library' ? 'Library' : 'Lab'}
    </Badge>
  );

  return (
    <aside
      className={`
        flex-shrink-0 h-full flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]
        fixed md:relative z-50 md:z-auto
        ${isOpen ? 'w-[288px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden'}
      `}
      style={{
        backgroundColor: 'var(--bg-100)',
        borderRight: '1px solid var(--border-300)',
      }}
    >
      <div className={`flex flex-col h-full w-[288px] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header: Logo + Mode Badge + Close */}
        <div className="relative flex w-full items-center p-2 pt-2">
          <div className="flex items-center gap-2 pl-2 h-8">
            <span className="font-semibold text-sm text-[var(--text-100)]">edward:labs</span>
            {modeBadge}
          </div>
          <div className="absolute flex items-center gap-1 right-3 top-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)]"
            >
              <PanelLeftClose size={16} />
            </Button>
          </div>
        </div>

        {sidebarPanel === 'settings' ? (
          /* Settings panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSidebarPanelChange('none')}
                className="h-7 w-7 text-[var(--text-500)] hover:text-[var(--text-100)]"
              >
                <ArrowLeft size={14} />
              </Button>
              <SettingsIcon size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-xs font-semibold text-[var(--text-100)]">Settings</span>
            </div>
            <SidebarSettingsPanel
              theme={theme}
              onToggleTheme={onToggleTheme}
              {...settingsProps}
            />
          </div>
        ) : sidebarPanel === 'token-stats' ? (
          /* Token Stats panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSidebarPanelChange('none')}
                className="h-7 w-7 text-[var(--text-500)] hover:text-[var(--text-100)]"
              >
                <ArrowLeft size={14} />
              </Button>
              <BarChart3 size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-xs font-semibold text-[var(--text-100)]">Token Stats</span>
            </div>
            <SidebarTokenStatsPanel availableModels={availableModels} />
          </div>
        ) : currentMode === 'experiments' ? (
          /* Experiments mode: tool navigation + conversation history */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 pt-2">
              {sectionLabel('Tools')}
              <ul className="space-y-0.5">
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'rag')}
                    onClick={() => navigate('/experiments/rag')}
                  >
                    <Database size={16} className={activeView === 'rag' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">RAG</span>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'plugin-agent')}
                    onClick={() => navigate('/experiments/plugin-agent')}
                  >
                    <Puzzle size={16} className={activeView === 'plugin-agent' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">Plug-in Agent</span>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'stitch')}
                    onClick={() => navigate('/experiments/stitch')}
                  >
                    <Layers size={16} className={activeView === 'stitch' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">Stitch</span>
                  </Button>
                </li>
              </ul>
            </div>

            {/* Experiment conversation history */}
            {activeView !== 'stitch' && (
              <>
                <div className="px-2 pt-1">
                  <Button
                    variant="ghost"
                    className={sidebarItemClassName}
                    onClick={onNewChat}
                  >
                    <div
                      className="flex items-center justify-center rounded-full w-5 h-5 transition-all duration-200 group-hover:scale-110"
                      style={{ backgroundColor: 'var(--surface-hover)' }}
                    >
                      <Plus size={14} className="text-[var(--text-300)]" />
                    </div>
                    <span>New chat</span>
                  </Button>
                </div>

                <ScrollArea className="flex-1 px-2 pt-2">
                  {todayConvos.length > 0 && (
                    <>
                      {sectionLabel('Today')}
                      <ul className="space-y-0.5">
                        {todayConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {yesterdayConvos.length > 0 && (
                    <>
                      {sectionLabel('Yesterday')}
                      <ul className="space-y-0.5">
                        {yesterdayConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {lastWeekConvos.length > 0 && (
                    <>
                      {sectionLabel('Last 7 Days')}
                      <ul className="space-y-0.5">
                        {lastWeekConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {olderConvos.length > 0 && (
                    <>
                      {sectionLabel('Older')}
                      <ul className="space-y-0.5">
                        {olderConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {conversations.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-xs text-[var(--text-500)]">
                      <p>No conversations yet</p>
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        ) : currentMode === 'library' ? (
          /* Library mode: simple info sidebar */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 pt-2">
              {sectionLabel('Library')}
              <ul className="space-y-0.5">
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(true)}
                    onClick={() => navigate('/library')}
                  >
                    <Package size={18} className="text-[var(--text-100)]" />
                    <span className="truncate text-base">All Components</span>
                  </Button>
                </li>
              </ul>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
              <Package size={36} className="mb-3 text-[var(--text-500)]" />
              <p className="text-sm font-medium mb-1 text-[var(--text-300)]">Component Library</p>
              <p className="text-xs leading-relaxed text-[var(--text-500)]">
                Browse, search, and manage reusable components. Use the AI agent to find or create components.
              </p>
            </div>
          </div>
        ) : (
          /* Chat mode: standard sidebar */
          <>
            {/* New Chat */}
            <div className="px-2 pt-1">
              <Button
                variant="ghost"
                className={sidebarItemClassName}
                onClick={onNewChat}
              >
                <div
                  className="flex items-center justify-center rounded-full w-5 h-5 transition-all duration-200 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--surface-hover)' }}
                >
                  <Plus size={14} className="text-[var(--text-300)]" />
                </div>
                <span>New chat</span>
                <span className="ml-auto text-xs opacity-0 group-hover:opacity-60 transition-opacity text-[var(--text-500)]">
                  Ctrl+⇧+O
                </span>
              </Button>
            </div>

            {/* Conversation History */}
            <ScrollArea className="flex-1 px-2 pt-2">
              {todayConvos.length > 0 && (
                <>
                  {sectionLabel('Today')}
                  <ul className="space-y-0.5">
                    {todayConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {yesterdayConvos.length > 0 && (
                <>
                  {sectionLabel('Yesterday')}
                  <ul className="space-y-0.5">
                    {yesterdayConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {lastWeekConvos.length > 0 && (
                <>
                  {sectionLabel('Last 7 Days')}
                  <ul className="space-y-0.5">
                    {lastWeekConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {olderConvos.length > 0 && (
                <>
                  {sectionLabel('Older')}
                  <ul className="space-y-0.5">
                    {olderConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-xs text-[var(--text-500)]">
                  <p>No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Footer */}
        <div className="p-2 space-y-0.5">
          <Separator className="mx-1 my-1 bg-[var(--border-300)]" />

          <Button
            variant="ghost"
            className={sidebarItemClassName}
            onClick={() => navigate('/')}
          >
            <Home size={16} />
            <span>Back to selector</span>
          </Button>

          {onOpenTokenStats && (
            <Button
              variant="ghost"
              className={sidebarItemClassName}
              onClick={() => onSidebarPanelChange('token-stats')}
            >
              <BarChart3 size={16} />
              <span>Token Stats</span>
            </Button>
          )}

          <Button
            variant="ghost"
            className={sidebarItemClassName}
            onClick={() => onSidebarPanelChange('settings')}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </Button>

          <Button
            variant="ghost"
            className={sidebarItemClassName}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>

          <Separator className="mx-1 my-1 bg-[var(--border-300)]" />

          {/* User profile */}
          <div className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-sm font-bold bg-[var(--bg-300)] text-[var(--text-300)]"
              >
                E
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate text-[var(--text-100)]">Edward</span>
              <span className="text-xs truncate text-[var(--text-500)]">
                {currentModelName || 'MiMo V2.5'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
