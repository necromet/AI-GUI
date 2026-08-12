import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, BarChart3, MessageSquare } from 'lucide-react';
import * as db from '../services/apiDatabaseAdapter';
import { ModelConfig } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SlidingGroup } from '@/components/ui/sliding-group';

interface SidebarTokenStatsPanelProps {
  availableModels?: ModelConfig[];
}

interface OverallStats {
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  conversationCount: number;
}

interface ModelStats {
  modelName: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
}

interface ConversationStats {
  conversationId: number;
  conversationTitle: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  updatedAt: string;
}

type View = 'overview' | 'models' | 'conversations';

const SidebarTokenStatsPanel: React.FC<SidebarTokenStatsPanelProps> = ({ availableModels = [] }) => {
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [conversationStats, setConversationStats] = useState<ConversationStats[]>([]);
  const [selectedView, setSelectedView] = useState<View>('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [overall, models, conversations] = await Promise.all([
        db.getOverallTokenStats(),
        db.getTokenStatsByModel(),
        db.getTokenStatsByConversation(20),
      ]);
      setOverallStats(overall);
      setModelStats(models);
      setConversationStats(conversations);
    } catch (error) {
      console.error('Failed to load token statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCompact = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  const section = (title: string) => (
    <div className="pt-4 pb-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-500)' }}>{title}</span>
    </div>
  );

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
    { id: 'models' as const, label: 'Models', icon: Zap },
    { id: 'conversations' as const, label: 'Chats', icon: MessageSquare },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--neon-color)', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab buttons */}
      <div className="px-3 pt-3 pb-2">
        <SlidingGroup
          direction="horizontal"
          activeKey={selectedView}
          onSelect={(key) => setSelectedView(key as 'overview' | 'models' | 'conversations')}
          className="gap-1 p-0.5 rounded-lg"
          style={{ backgroundColor: 'var(--bg-200)' }}
          indicatorStyle={{ top: 2, bottom: 2 }}
          items={tabs.map(({ id, label, icon: Icon }) => ({
            key: id,
            label,
            icon: <Icon size={13} />,
          }))}
          renderItem={(item, isActive) => (
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          )}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 pb-4">
          {selectedView === 'overview' && overallStats && (
            <div className="space-y-3">
              {/* Metric cards - 2x2 grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total', value: overallStats.totalTokens, color: '#3b82f6' },
                  { label: 'Prompt', value: overallStats.promptTokens, color: '#10b981' },
                  { label: 'Response', value: overallStats.candidatesTokens, color: '#8b5cf6' },
                  { label: 'Messages', value: overallStats.messageCount, color: '#f59e0b' },
                ].map((metric, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-500)' }}>{metric.label}</p>
                    <p className="text-base font-bold" style={{ color: 'var(--text-100)' }}>{formatCompact(metric.value)}</p>
                    <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-300)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: metric.color,
                          width: `${Math.min(100, (metric.value / Math.max(overallStats.totalTokens, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {section('Summary')}
              <div className="space-y-2">
                {[
                  { label: 'Conversations', value: overallStats.conversationCount },
                  { label: 'Avg/Message', value: overallStats.messageCount > 0 ? formatCompact(Math.round(overallStats.totalTokens / overallStats.messageCount)) : '0' },
                  { label: 'Prompt:Response', value: overallStats.candidatesTokens > 0 ? (overallStats.promptTokens / overallStats.candidatesTokens).toFixed(1) + ':1' : 'N/A' },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-xs" style={{ color: 'var(--text-500)' }}>{stat.label}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedView === 'models' && (
            <div className="space-y-2">
              {(() => {
                const usageMap = new Map(modelStats.map(m => [m.modelName, m]));
                const allModels = availableModels.map(am => {
                  const usage = usageMap.get(am.name) || usageMap.get(am.id);
                  return {
                    name: am.name,
                    totalTokens: usage?.totalTokens || 0,
                    messageCount: usage?.messageCount || 0,
                  };
                });
                const maxTokens = Math.max(...allModels.map(m => m.totalTokens), 1);

                return allModels.map((model, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium truncate flex-1 mr-2" style={{ color: 'var(--text-100)' }}>{model.name}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-500)' }}>{formatCompact(model.totalTokens)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-300)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: 'var(--neon-color)',
                          width: `${(model.totalTokens / maxTokens) * 100}%`,
                          opacity: model.totalTokens > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{model.messageCount} msgs</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {selectedView === 'conversations' && (
            <div className="space-y-2">
              {conversationStats.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={20} className="mx-auto mb-2" style={{ color: 'var(--text-500)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>No usage data yet</p>
                </div>
              ) : (
                conversationStats.map((conv, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
                  >
                    <p className="text-xs font-medium truncate mb-1.5" style={{ color: 'var(--text-100)' }}>
                      {conv.conversationTitle}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                        {formatCompact(conv.totalTokens)} tokens
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                        {conv.messageCount} msgs
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border-300)' }}>
        <p className="text-[10px] text-center" style={{ color: 'var(--text-500)' }}>
          Token counts are estimates from stored history.
        </p>
      </div>
    </div>
  );
};

export default SidebarTokenStatsPanel;
