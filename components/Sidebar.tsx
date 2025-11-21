import React from 'react';
import { Plus, PanelLeftClose, History } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNewChat }) => {
  // Mock history data
  const historyItems = [
    "React component help",
    "Explain Quantum Physics",
    "Debug Python script",
    "Dinner recipes",
    "Tailwind CSS grid",
    "Gemini API docs",
    "Vacation in Japan",
  ];

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
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-gray-200 bg-transparent hover:bg-hover hover:shadow-[0_0_10px_rgba(0,243,255,0.1)] hover:border-neon-blue/30 transition-all border border-white/10 text-sm font-medium"
          >
            <Plus size={16} className="text-neon-blue" />
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
          <div className="text-xs font-semibold text-gray-500 mb-2 px-2 tracking-wider uppercase">Today</div>
          <ul>
            {historyItems.map((item, idx) => (
              <li key={idx}>
                <button className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-hover hover:text-neon-blue transition-colors truncate group">
                  <span className="truncate relative flex-1">
                     {item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="text-xs font-semibold text-gray-500 mt-6 mb-2 px-2 tracking-wider uppercase">Yesterday</div>
          <ul>
               <li>
                <button className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-hover hover:text-neon-blue transition-colors truncate">
                  Creative Writing
                </button>
              </li>
          </ul>
        </div>

        {/* Footer / User Profile */}
        <div className="p-3 border-t border-white/5">
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-100 hover:bg-hover transition-colors group">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(188,19,254,0.4)]">
                JD
             </div>
             <div className="text-left font-medium group-hover:text-neon-purple transition-colors">
               <div>John Doe</div>
               <div className="text-xs text-gray-500">Premium</div>
             </div>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;