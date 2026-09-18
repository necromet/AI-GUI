"use client"

import { useState, useEffect } from 'react';
import { Plus, X, Plug, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemedPopover, ThemedPopoverTrigger, ThemedPopoverContent } from './ThemedPopover';

interface MCPServer {
  id: string;
  name: string;
  url: string;
  description?: string;
  tools?: string[];
  connection_status?: string;
  enabled?: boolean;
}

interface Props {
  selectedServerIds: string[];
  onUpdate: (serverIds: string[]) => void;
}

export default function MCPToolPicker({ selectedServerIds, onUpdate }: Props) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!popoverOpen || servers.length > 0) return;
    setLoading(true);
    fetch('/api/workflows/mcp-servers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setServers(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [popoverOpen, servers.length]);

  const toggleServer = (serverId: string) => {
    if (selectedServerIds.includes(serverId)) {
      onUpdate(selectedServerIds.filter(id => id !== serverId));
    } else {
      onUpdate([...selectedServerIds, serverId]);
    }
  };

  const removeServer = (serverId: string) => {
    onUpdate(selectedServerIds.filter(id => id !== serverId));
  };

  const selectedServers = servers.filter(s => selectedServerIds.includes(s.id));

  return (
    <div className="space-y-2">
      {/* Selected servers list */}
      <AnimatePresence>
        {selectedServers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5"
          >
            {selectedServers.map(server => (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg border group transition-colors"
                style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Plug size={12} style={{ color: 'var(--neon-color)' }} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-100)' }}>
                      {server.name}
                    </div>
                    {server.tools && server.tools.length > 0 && (
                      <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                        {server.tools.length} tools
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeServer(server.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-[var(--bg-300)]"
                  style={{ color: 'var(--text-500)' }}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add MCP Tool popover */}
      <ThemedPopover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <ThemedPopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 w-full text-[10px] font-medium px-2.5 py-2 rounded-lg border cursor-pointer transition-colors hover:scale-[1.01] active:scale-[0.99]"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}
          >
            <Plus size={12} />
            Add MCP Tool
          </button>
        </ThemedPopoverTrigger>
        <ThemedPopoverContent align="start" side="bottom" className="w-72 p-2">
          <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-500)' }}>
            MCP Servers
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-500)' }} />
            </div>
          ) : servers.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                No MCP servers configured
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-500)' }}>
                Add servers in Settings → MCP Registry
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {servers.map(server => {
                const isSelected = selectedServerIds.includes(server.id);
                const isExpanded = expandedId === server.id;
                return (
                  <div
                    key={server.id}
                    className="rounded-lg border overflow-hidden transition-colors"
                    style={{
                      borderColor: isSelected ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
                      backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.05)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : server.id)}
                      className="w-full px-2.5 py-2 flex items-center justify-between text-left transition-colors cursor-pointer"
                      style={{ color: 'var(--text-100)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-300)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate">{server.name}</span>
                        {server.tools && (
                          <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                            {server.tools.length} tools
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={12}
                        className={cn("transition-transform shrink-0", isExpanded && "rotate-180")}
                        style={{ color: 'var(--text-500)' }}
                      />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 space-y-2 border-t" style={{ borderColor: 'var(--border-300)' }}>
                            {server.description && (
                              <p className="text-[10px] pt-2" style={{ color: 'var(--text-500)' }}>
                                {server.description}
                              </p>
                            )}
                            {server.tools && server.tools.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {server.tools.map((tool: string) => (
                                  <span
                                    key={tool}
                                    className="text-[9px] px-1.5 py-0.5 rounded border"
                                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)' }}
                                  >
                                    {tool}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => toggleServer(server.id)}
                              className="w-full text-[10px] font-medium px-2.5 py-1.5 rounded-md cursor-pointer transition-colors active:scale-[0.98]"
                              style={{
                                backgroundColor: isSelected ? 'var(--bg-300)' : 'var(--neon-color)',
                                color: isSelected ? 'var(--text-300)' : '#000',
                                border: isSelected ? '1px solid var(--border-300)' : 'none',
                              }}
                            >
                              {isSelected ? 'Remove' : 'Add to Agent'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </ThemedPopoverContent>
      </ThemedPopover>
    </div>
  );
}
