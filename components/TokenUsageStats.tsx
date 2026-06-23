import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, MessageSquare, Zap, BarChart3, Activity } from 'lucide-react';
import * as db from '../services/databaseAdapter';
import * as RechartsPrimitive from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ModelConfig } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const THEMES = { light: "", dark: ".dark" } as const;

type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color);
  if (!colorConfig.length) return null;
  return (
    <style dangerouslySetInnerHTML={{
      __html: Object.entries(THEMES).map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, itemConfig]) => {
  const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
  return color ? `  --color-${key}: ${color};` : null;
}).join("\n")}
}`).join("\n"),
    }} />
  );
};

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

interface TokenUsageStatsProps {
  isOpen: boolean;
  onClose: () => void;
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

const CHART_COLORS = [
  'var(--neon-color)',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#6366f1',
  '#14b8a6',
  '#e11d48',
  '#a855f7',
];

const chartConfig = {
  capacity: {
    label: "Usage",
    color: "var(--neon-color)",
  },
} satisfies ChartConfig;

const TokenUsageStats: React.FC<TokenUsageStatsProps> = ({ isOpen, onClose, availableModels = [] }) => {
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [dateStats, setDateStats] = useState<DateStats[]>([]);
  const [conversationStats, setConversationStats] = useState<ConversationStats[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'models' | 'timeline' | 'conversations'>('overview');
  const [timeRange, setTimeRange] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) loadStats();
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

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
  const formatCompact = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (!isOpen) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'models', label: 'By Model', icon: Zap },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-300 dark:border-white/[0.08]" style={{ boxShadow: '0 0 80px -20px rgba(var(--neon-rgb), 0.1), 0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Top neon accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, var(--neon-color), transparent)`, boxShadow: `0 0 20px rgba(var(--neon-rgb), 0.5)` }} />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-300 dark:border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--neon-rgb), 0.08)', border: '1px solid rgba(var(--neon-rgb), 0.15)' }}>
              <Activity className="h-6 w-6" style={{ color: 'var(--neon-color)' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Token Usage</h2>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Monitor API consumption and patterns</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                color: selectedView === id ? 'var(--neon-color)' : undefined,
                background: selectedView === id ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                border: selectedView === id ? '1px solid rgba(var(--neon-rgb), 0.15)' : '1px solid transparent',
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--neon-color)', animation: 'spin 1s linear infinite' }} />
                <div className="absolute inset-2 rounded-full border-2 border-transparent" style={{ borderBottomColor: 'var(--neon-color)', animation: 'spin 1.5s linear infinite reverse' }} />
              </div>
              <span className="text-sm text-gray-500">Loading statistics...</span>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {selectedView === 'overview' && overallStats && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Tokens', value: overallStats.totalTokens, icon: TrendingUp, gradient: 'from-blue-500/10 to-blue-600/5', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400', borderColor: 'border-blue-500/10' },
                      { label: 'Prompt Tokens', value: overallStats.promptTokens, icon: MessageSquare, gradient: 'from-emerald-500/10 to-emerald-600/5', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/10' },
                      { label: 'Response Tokens', value: overallStats.candidatesTokens, icon: Zap, gradient: 'from-purple-500/10 to-purple-600/5', iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400', borderColor: 'border-purple-500/10' },
                      { label: 'Messages', value: overallStats.messageCount, icon: BarChart3, gradient: 'from-amber-500/10 to-amber-600/5', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400', borderColor: 'border-amber-500/10' },
                    ].map((metric, i) => (
                      <div
                        key={i}
                        className={`relative rounded-xl p-5 bg-gradient-to-br ${metric.gradient} border ${metric.borderColor} backdrop-blur-sm group hover:scale-[1.02] transition-all duration-300`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{metric.label}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatNumber(metric.value)}</p>
                          </div>
                          <div className={`p-2.5 rounded-lg ${metric.iconBg}`}>
                            <metric.icon className={`h-5 w-5 ${metric.iconColor}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Usage breakdown */}
                  <div className="rounded-xl border border-gray-300 dark:border-white/[0.06] p-6 bg-gray-50/50 dark:bg-white/[0.02]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 uppercase tracking-wider">Usage Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {[
                        { label: 'Conversations', value: overallStats.conversationCount },
                        { label: 'Avg Tokens/Message', value: overallStats.messageCount > 0 ? Math.round(overallStats.totalTokens / overallStats.messageCount) : 0 },
                        { label: 'Prompt/Response Ratio', value: overallStats.candidatesTokens > 0 ? (overallStats.promptTokens / overallStats.candidatesTokens).toFixed(2) : 'N/A' },
                      ].map((stat, i) => (
                        <div key={i}>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">{stat.label}</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Models Tab - Radial Bar Chart Cards */}
              {selectedView === 'models' && (() => {
                const usageMap = new Map(modelStats.map(m => [m.modelName, m]));
                const allModels = availableModels.map(am => {
                  const usage = usageMap.get(am.name) || usageMap.get(am.id);
                  return {
                    modelName: am.name,
                    modelId: am.id,
                    description: am.description,
                    isCustom: am.isCustom,
                    totalTokens: usage?.totalTokens || 0,
                    promptTokens: usage?.promptTokens || 0,
                    candidatesTokens: usage?.candidatesTokens || 0,
                    messageCount: usage?.messageCount || 0,
                    hasUsage: !!usage,
                  };
                });
                const usageOnlyModels = modelStats
                  .filter(ms => !availableModels.some(am => am.name === ms.modelName || am.id === ms.modelName))
                  .map(ms => ({
                    modelName: ms.modelName,
                    modelId: ms.modelName,
                    description: undefined as string | undefined,
                    isCustom: false,
                    totalTokens: ms.totalTokens,
                    promptTokens: ms.promptTokens,
                    candidatesTokens: ms.candidatesTokens,
                    messageCount: ms.messageCount,
                    hasUsage: true,
                  }));
                const mergedModels = [...allModels, ...usageOnlyModels];
                const maxTokens = Math.max(...mergedModels.map(m => m.totalTokens), 1);

                return (
                  <div className="animate-fade-in">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 uppercase tracking-wider">Token Usage by Model</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {mergedModels.map((model, index) => {
                        const percentage = Math.round((model.totalTokens / maxTokens) * 100);
                        const chartData = [{ name: model.modelName, capacity: percentage || 0 }];
                        const fill = CHART_COLORS[index % CHART_COLORS.length];

                        return (
                          <div
                            key={model.modelId + index}
                            className="relative rounded-xl border border-gray-300 dark:border-white/[0.08] p-5 bg-white dark:bg-white/[0.02] hover:border-gray-400 dark:hover:border-white/[0.15] transition-all duration-300 hover:shadow-lg group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="relative flex-shrink-0">
                                <ChartContainer config={chartConfig} className="h-[80px] w-[80px]">
                                  <RechartsPrimitive.RadialBarChart
                                    data={chartData}
                                    innerRadius={28}
                                    outerRadius={38}
                                    barSize={6}
                                    startAngle={90}
                                    endAngle={-270}
                                  >
                                    <RechartsPrimitive.PolarAngleAxis
                                      type="number"
                                      domain={[0, 100]}
                                      angleAxisId={0}
                                      tick={false}
                                      axisLine={false}
                                    />
                                    <RechartsPrimitive.RadialBar
                                      dataKey="capacity"
                                      background
                                      cornerRadius={10}
                                      fill={fill}
                                      angleAxisId={0}
                                    />
                                  </RechartsPrimitive.RadialBarChart>
                                </ChartContainer>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {model.hasUsage ? `${percentage}%` : '0%'}
                                  </span>
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={model.modelName}>
                                  {model.modelName}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {model.hasUsage ? `${formatCompact(model.totalTokens)} tokens` : 'No usage yet'}
                                </p>
                                {model.isCustom && (
                                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(var(--neon-rgb), 0.08)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.15)' }}>
                                    CUSTOM
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Prompt</p>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{formatCompact(model.promptTokens)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Response</p>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{formatCompact(model.candidatesTokens)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Messages</p>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{model.messageCount}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Timeline Tab */}
              {selectedView === 'timeline' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Token Usage Timeline</h3>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(Number(e.target.value))}
                      className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400 dark:focus:border-white/20 transition-colors"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                  </div>

                  {dateStats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Calendar className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm">No timeline data available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dateStats.map((stat, index) => {
                        const maxTokens = Math.max(...dateStats.map(s => s.totalTokens));
                        const percentage = maxTokens > 0 ? (stat.totalTokens / maxTokens) * 100 : 0;

                        return (
                          <div key={index} className="rounded-xl border border-gray-300 dark:border-white/[0.06] p-4 bg-white dark:bg-white/[0.02] hover:border-gray-400 dark:hover:border-white/[0.1] transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatDate(stat.date)}
                              </span>
                              <span className="text-xs font-mono font-bold" style={{ color: 'var(--neon-color)' }}>
                                {formatNumber(stat.totalTokens)} tokens
                              </span>
                            </div>

                            <div className="w-full bg-gray-100 dark:bg-white/[0.04] rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${percentage}%`,
                                  background: `linear-gradient(90deg, var(--neon-color), rgba(var(--neon-rgb), 0.5))`,
                                  boxShadow: `0 0 10px rgba(var(--neon-rgb), 0.3)`,
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between mt-2.5 text-[11px] text-gray-500">
                              <span>Prompt: {formatNumber(stat.promptTokens)}</span>
                              <span>Response: {formatNumber(stat.candidatesTokens)}</span>
                              <span>{stat.messageCount} msgs</span>
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
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Top Conversations by Token Usage
                  </h3>
                  {conversationStats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm">No conversation data available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversationStats.map((conv, index) => (
                        <div key={conv.conversationId} className="rounded-xl border border-gray-300 dark:border-white/[0.06] p-4 bg-white dark:bg-white/[0.02] hover:border-gray-400 dark:hover:border-white/[0.1] transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {conv.conversationTitle}
                              </h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Last updated: {new Date(conv.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold" style={{ color: 'var(--neon-color)' }}>
                                {formatCompact(conv.totalTokens)}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">tokens</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Prompt</p>
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{formatNumber(conv.promptTokens)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Response</p>
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{formatNumber(conv.candidatesTokens)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Messages</p>
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{conv.messageCount}</p>
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
        <div className="px-6 py-4 border-t border-gray-300 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.01]">
          <p className="text-[11px] text-gray-400 text-center">
            Token counts are estimates based on stored conversation history. Actual API billing may vary.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenUsageStats;
