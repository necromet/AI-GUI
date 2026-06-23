import React from 'react';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, User, Database, BarChart3, Sun, Moon } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenDatabase?: () => void;
  onOpenTokenStats?: () => void;
  conversations: ChatSession[];
  currentConversationId: number | null;
  onSelectConversation: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNewChat,
  onOpenSettings,
  onOpenDatabase,
  onOpenTokenStats,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  theme,
  onToggleTheme
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

  const renderConversation = (conv: ChatSession) => {
    const isActive = conv.dbConversationId === currentConversationId;
    return (
      <li key={conv.id}>
        <div
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 truncate group cursor-pointer relative ${
            isActive
              ? 'bg-gray-100 dark:bg-white/[0.06]'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          {/* Active indicator bar */}
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
              style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 8px var(--neon-color)' }}
            />
          )}
          <span
            className="truncate relative flex-1 transition-colors duration-200"
            style={{ color: isActive ? 'var(--neon-color)' : undefined }}
          >
            {conv.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all duration-200"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </li>
    );
  };

  return (
    <aside
      className={`
        flex-shrink-0 bg-white dark:bg-sidebar h-full flex flex-col border-r border-gray-300 dark:border-white/[0.04]
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'w-[260px] translate-x-0' : 'w-0 -translate-x-10 opacity-0 md:opacity-100 md:translate-x-0 overflow-hidden'}
      `}
    >
      <div className={`flex flex-col h-full w-[260px] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header */}
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={onNewChat}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200 border border-gray-300 dark:border-white/[0.06] hover:border-gray-400 dark:hover:border-white/[0.1] text-sm font-medium group"
          >
            <Plus size={16} style={{ color: 'var(--neon-color)' }} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>New chat</span>
          </button>
          <button
            onClick={onToggle}
            className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-xl transition-all duration-200"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-gray-300 dark:bg-white/[0.04]" />

        {/* History */}
        <div className="flex-1 overflow-y-auto scrollbar-hidden px-3 py-3">
          {todayConvos.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mb-2 px-3 tracking-[0.15em] uppercase">Today</div>
              <ul className="space-y-0.5">
                {todayConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {yesterdayConvos.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-5 mb-2 px-3 tracking-[0.15em] uppercase">Yesterday</div>
              <ul className="space-y-0.5">
                {yesterdayConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {lastWeekConvos.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-5 mb-2 px-3 tracking-[0.15em] uppercase">Last 7 Days</div>
              <ul className="space-y-0.5">
                {lastWeekConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {olderConvos.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-5 mb-2 px-3 tracking-[0.15em] uppercase">Older</div>
              <ul className="space-y-0.5">
                {olderConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 text-xs">
              <p>No conversations yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-300 dark:border-white/[0.04] space-y-0.5">
          {onOpenDatabase && typeof window !== 'undefined' && window.electron !== undefined && (
            <button
              onClick={onOpenDatabase}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
            >
              <Database size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              <span className="font-medium">Database</span>
            </button>
          )}

          {onOpenTokenStats && (
            <button
              onClick={onOpenTokenStats}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
            >
              <BarChart3 size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              <span className="font-medium">Token Stats</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
          >
            <SettingsIcon size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            <span className="font-medium">Settings</span>
          </button>

          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
          >
            {theme === 'dark' ? (
              <Sun size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            ) : (
              <Moon size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            )}
            <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <div className="mx-1 h-px bg-gray-300 dark:bg-white/[0.04] my-1" />

          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400"
              style={{ background: 'rgba(var(--neon-rgb), 0.08)', border: '1px solid rgba(var(--neon-rgb), 0.15)' }}
            >
              <User size={15} strokeWidth={2} />
            </div>
            <span className="font-medium group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">Edward</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
