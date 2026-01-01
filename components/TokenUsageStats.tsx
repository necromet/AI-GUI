import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, MessageSquare, Zap, BarChart3 } from 'lucide-react';
import * as db from '../services/databaseAdapter';

interface TokenUsageStatsProps {
  isOpen: boolean;
  onClose: () => void;
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

interface DateStats {
  date: string;
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

const TokenUsageStats: React.FC<TokenUsageStatsProps> = ({ isOpen, onClose }) => {
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [dateStats, setDateStats] = useState<DateStats[]>([]);
  const [conversationStats, setConversationStats] = useState<ConversationStats[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'models' | 'timeline' | 'conversations'>('overview');
  const [timeRange, setTimeRange] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen, timeRange]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [overall, models, dates, conversations] = await Promise.all([
        db.getOverallTokenStats(),
        db.getTokenStatsByModel(),
        db.getTokenStatsByDate(timeRange),
        db.getTokenStatsByConversation(20)
      ]);
      
      setOverallStats(overall);
      setModelStats(models);
      setDateStats(dates);
      setConversationStats(conversations);
    } catch (error) {
      console.error('Failed to load token statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[var(--neon-color)] to-purple-600 rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Token Usage Statistics</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Monitor your API consumption and patterns</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-zinc-200 dark:border-zinc-700">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'models', label: 'By Model', icon: Zap },
            { id: 'timeline', label: 'Timeline', icon: Calendar },
            { id: 'conversations', label: 'Conversations', icon: MessageSquare }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id as any)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                selectedView === id
                  ? 'border-[var(--neon-color)] text-[var(--neon-color)]'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--neon-color)]"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {selectedView === 'overview' && overallStats && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-90">Total Tokens</p>
                          <p className="text-3xl font-bold mt-1">{formatNumber(overallStats.totalTokens)}</p>
                        </div>
                        <TrendingUp className="h-10 w-10 opacity-80" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-90">Prompt Tokens</p>
                          <p className="text-3xl font-bold mt-1">{formatNumber(overallStats.promptTokens)}</p>
                        </div>
                        <MessageSquare className="h-10 w-10 opacity-80" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-90">Response Tokens</p>
                          <p className="text-3xl font-bold mt-1">{formatNumber(overallStats.candidatesTokens)}</p>
                        </div>
                        <Zap className="h-10 w-10 opacity-80" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-90">Messages</p>
                          <p className="text-3xl font-bold mt-1">{formatNumber(overallStats.messageCount)}</p>
                        </div>
                        <BarChart3 className="h-10 w-10 opacity-80" />
                      </div>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Usage Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Conversations</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{overallStats.conversationCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Avg Tokens/Message</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {overallStats.messageCount > 0 
                            ? Math.round(overallStats.totalTokens / overallStats.messageCount)
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Prompt/Response Ratio</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {overallStats.candidatesTokens > 0
                            ? (overallStats.promptTokens / overallStats.candidatesTokens).toFixed(2)
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Models Tab */}
              {selectedView === 'models' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Token Usage by Model</h3>
                  {modelStats.length === 0 ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {modelStats.map((model, index) => {
                        const maxTokens = modelStats[0]?.totalTokens || 1;
                        const percentage = (model.totalTokens / maxTokens) * 100;
                        
                        return (
                          <div key={index} className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-zinc-900 dark:text-white">{model.modelName}</h4>
                              <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                                {formatNumber(model.totalTokens)} tokens
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-2 mb-3">
                              <div
                                className="bg-gradient-to-r from-[var(--neon-color)] to-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-zinc-600 dark:text-zinc-400">Prompt</p>
                                <p className="font-semibold text-zinc-900 dark:text-white">
                                  {formatNumber(model.promptTokens)}
                                </p>
                              </div>
                              <div>
                                <p className="text-zinc-600 dark:text-zinc-400">Response</p>
                                <p className="font-semibold text-zinc-900 dark:text-white">
                                  {formatNumber(model.candidatesTokens)}
                                </p>
                              </div>
                              <div>
                                <p className="text-zinc-600 dark:text-zinc-400">Messages</p>
                                <p className="font-semibold text-zinc-900 dark:text-white">
                                  {formatNumber(model.messageCount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline Tab */}
              {selectedView === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Token Usage Timeline</h3>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(Number(e.target.value))}
                      className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                  </div>
                  
                  {dateStats.length === 0 ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">No data available</p>
                  ) : (
                    <div className="space-y-2">
                      {dateStats.map((stat, index) => {
                        const maxTokens = Math.max(...dateStats.map(s => s.totalTokens));
                        const percentage = maxTokens > 0 ? (stat.totalTokens / maxTokens) * 100 : 0;
                        
                        return (
                          <div key={index} className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {formatDate(stat.date)}
                              </span>
                              <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                                {formatNumber(stat.totalTokens)} tokens
                              </span>
                            </div>
                            
                            <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-[var(--neon-color)] to-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                              <span>Prompt: {formatNumber(stat.promptTokens)}</span>
                              <span>Response: {formatNumber(stat.candidatesTokens)}</span>
                              <span>{stat.messageCount} messages</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Conversations Tab */}
              {selectedView === 'conversations' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Top Conversations by Token Usage
                  </h3>
                  {conversationStats.length === 0 ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {conversationStats.map((conv, index) => (
                        <div key={conv.conversationId} className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">
                                {conv.conversationTitle}
                              </h4>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                Last updated: {new Date(conv.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-[var(--neon-color)]">
                                {formatNumber(conv.totalTokens)}
                              </p>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400">tokens</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-600 dark:text-zinc-400">Prompt</p>
                              <p className="font-semibold text-zinc-900 dark:text-white">
                                {formatNumber(conv.promptTokens)}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-600 dark:text-zinc-400">Response</p>
                              <p className="font-semibold text-zinc-900 dark:text-white">
                                {formatNumber(conv.candidatesTokens)}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-600 dark:text-zinc-400">Messages</p>
                              <p className="font-semibold text-zinc-900 dark:text-white">
                                {formatNumber(conv.messageCount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center">
            Token counts are estimates and may vary from actual API billing. This data is based on stored conversation history.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenUsageStats;
