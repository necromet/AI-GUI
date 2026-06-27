import React from 'react';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, User, BarChart3, Sun, Moon, Database, Puzzle } from 'lucide-react';
import { ChatSession } from '../types';

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
  activeView: 'chat' | 'rag' | 'plugin-agent';
  onNavigate: (view: 'chat' | 'rag' | 'plugin-agent') => void;
  currentModelName?: string;
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
  activeView,
  onNavigate,
  currentModelName
}) => {
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

  const isDark = theme === 'dark';

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    backgroundColor: isActive ? 'var(--bg-300)' : 'transparent',
    color: isActive ? 'var(--text-100)' : 'var(--text-500)',
  });

  const renderConversation = (conv: ChatSession) => {
    const isActive = conv.dbConversationId === currentConversationId;
    return (
      <li key={conv.id}>
        <div
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 truncate group cursor-pointer relative"
          style={itemStyle(isActive)}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'var(--bg-300)';
              e.currentTarget.style.color = 'var(--text-100)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-500)';
            }
          }}
        >
          <span className="truncate flex-1">
            {conv.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/10 transition-all duration-150"
            style={{ color: 'var(--text-500)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-500)'; }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </li>
    );
  };

  const sectionLabel = (text: string) => (
    <div className="px-3 pt-4 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>
        {text}
      </span>
    </div>
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

        {/* Header: Logo + Close */}
        <div className="relative flex w-full items-center p-2 pt-2">
          <div className="flex items-center gap-1.5 pl-2 h-8">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-100)' }}>edward:labs</span>
          </div>
          <div className="absolute flex items-center gap-1 right-3 top-2">
            <button
              onClick={onToggle}
              className="p-2 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-500)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        {/* New Chat */}
        <div className="px-2 pt-1">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
            style={{ color: 'var(--text-100)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div
              className="flex items-center justify-center rounded-full w-5 h-5 transition-all duration-200 group-hover:scale-110"
              style={{ backgroundColor: 'var(--surface-hover)' }}
            >
              <Plus size={14} style={{ color: 'var(--text-300)' }} />
            </div>
            <span className="font-medium">New chat</span>
            <span className="ml-auto text-[11px] opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text-500)' }}>
              Ctrl+⇧+O
            </span>
          </button>
        </div>

        {/* Experiment Navigation */}
        <div className="px-2 pt-2">
          {sectionLabel('Experiment')}
          <ul className="space-y-0.5">
            <li>
              <div
                onClick={() => onNavigate('rag')}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 truncate cursor-pointer"
                style={itemStyle(activeView === 'rag')}
                onMouseEnter={(e) => {
                  if (activeView !== 'rag') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-300)';
                    e.currentTarget.style.color = 'var(--text-100)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeView !== 'rag') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-500)';
                  }
                }}
              >
                <Database size={16} style={{ color: activeView === 'rag' ? 'var(--text-100)' : 'var(--text-500)' }} />
                <span className="truncate">RAG</span>
              </div>
            </li>
            <li>
              <div
                onClick={() => onNavigate('plugin-agent')}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 truncate cursor-pointer"
                style={itemStyle(activeView === 'plugin-agent')}
                onMouseEnter={(e) => {
                  if (activeView !== 'plugin-agent') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-300)';
                    e.currentTarget.style.color = 'var(--text-100)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeView !== 'plugin-agent') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-500)';
                  }
                }}
              >
                <Puzzle size={16} style={{ color: activeView === 'plugin-agent' ? 'var(--text-100)' : 'var(--text-500)' }} />
                <span className="truncate">Plug-in Agent</span>
              </div>
            </li>
          </ul>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto scrollbar-hidden px-2 pt-2">
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
            <div className="flex flex-col items-center justify-center h-full text-xs" style={{ color: 'var(--text-500)' }}>
              <p>No conversations yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 space-y-0.5" style={{ borderTop: '1px solid var(--border-300)' }}>
          {onOpenTokenStats && (
            <button
              onClick={onOpenTokenStats}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
              style={{ color: 'var(--text-500)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
            >
              <BarChart3 size={16} />
              <span className="font-medium">Token Stats</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: 'var(--text-500)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
          >
            <SettingsIcon size={16} />
            <span className="font-medium">Settings</span>
          </button>

          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: 'var(--text-500)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <div className="mx-1 my-1" style={{ height: '1px', backgroundColor: 'var(--border-300)' }} />

          {/* User profile */}
          <div
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-150"
            style={{ color: 'var(--text-500)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
            >
              E
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate" style={{ color: 'var(--text-100)' }}>Edward</span>
              <span className="text-[11px] truncate" style={{ color: 'var(--text-500)' }}>
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
