import React from 'react';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, User, Database } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenDatabase?: () => void;
  conversations: ChatSession[];
  currentConversationId: number | null;
  onSelectConversation: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onToggle, 
  onNewChat, 
  onOpenSettings,
  onOpenDatabase,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation
}) => {
  // Group conversations by time
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
    return (
      <li key={conv.id}>
        <div 
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors truncate group cursor-pointer ${
            conv.dbConversationId === currentConversationId
              ? 'bg-hover'
              : 'text-gray-300 hover:bg-hover'
          }`}
          style={{ color: conv.dbConversationId === currentConversationId ? 'var(--neon-color)' : undefined }}
          onMouseEnter={(e) => {
            if (conv.dbConversationId !== currentConversationId) {
              e.currentTarget.style.color = 'var(--neon-color)';
            }
          }}
          onMouseLeave={(e) => {
            if (conv.dbConversationId !== currentConversationId) {
              e.currentTarget.style.color = '';
            }
          }}
        >
          <span className="truncate relative flex-1">
            {conv.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 transition-all"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--neon-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '';
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </li>
    );
  };

  return (
    <aside 
      className={`
        flex-shrink-0 bg-sidebar h-full flex flex-col border-r border-white/5 
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'w-[260px] translate-x-0' : 'w-0 -translate-x-10 opacity-0 md:opacity-100 md:translate-x-0 overflow-hidden'}
      `}
    >
      {/* Inner container to prevent content squashing during transition */}
      <div className={`flex flex-col h-full w-[260px] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Header / New Chat */}
        <div className="p-3 flex items-center justify-between group">
          <button 
            onClick={onNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-gray-200 bg-transparent hover:bg-hover transition-all border border-white/10 text-sm font-medium"
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 10px rgba(var(--neon-rgb), 0.1)';
              e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Plus size={16} style={{ color: 'var(--neon-color)' }} />
            <span>New chat</span>
          </button>
          <button 
            onClick={onToggle}
            className="ml-2 p-2 text-gray-400 hover:text-white hover:bg-hover rounded-lg"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto scrollbar-hidden px-3 py-2">
          {todayConvos.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 mb-2 px-2 tracking-wider uppercase">Today</div>
              <ul>
                {todayConvos.map(renderConversation)}
              </ul>
            </>
          )}
          
          {yesterdayConvos.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 mt-6 mb-2 px-2 tracking-wider uppercase">Yesterday</div>
              <ul>
                {yesterdayConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {lastWeekConvos.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 mt-6 mb-2 px-2 tracking-wider uppercase">Last 7 Days</div>
              <ul>
                {lastWeekConvos.map(renderConversation)}
              </ul>
            </>
          )}

          {olderConvos.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 mt-6 mb-2 px-2 tracking-wider uppercase">Older</div>
              <ul>
                {olderConvos.map(renderConversation)}
              </ul>
            </>
          )}
        </div>

        {/* Footer / User Profile */}
        <div className="p-3 border-t border-white/5 space-y-1">
          {onOpenDatabase && typeof window !== 'undefined' && window.electron !== undefined && (
            <button 
              onClick={onOpenDatabase}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-100 hover:bg-hover transition-colors group"
            >
              <Database size={18} className="text-gray-400 group-hover:text-white" />
              <span className="font-medium">Database Viewer</span>
            </button>
          )}
          
          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-100 hover:bg-hover transition-colors group"
          >
            <SettingsIcon size={18} className="text-gray-400 group-hover:text-white" />
            <span className="font-medium">Settings</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-100 hover:bg-hover transition-colors group">
             <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 shadow-md">
                <User size={18} strokeWidth={2} />
             </div>
             <div 
               className="text-left font-medium transition-colors" 
               onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--neon-color)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
             >
               <div>Edward</div>
             </div>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;