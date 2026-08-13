import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Table2, Eye, Key, Hash, RefreshCw, Search, Link2, Copy, FileText, BarChart3, Plus } from 'lucide-react';
import { TableInfo, ColumnInfo } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface DatabaseSchemaBrowserProps {
  schemas: string[];
  tables: TableInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTable: (schema: string, table: string) => void;
  onQuickAction?: (action: string, schema: string, table: string) => void;
}

const getTypeColor = (dataType: string) => {
  const t = dataType.toLowerCase();
  if (t.includes('int') || t.includes('serial') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return '#60a5fa';
  if (t.includes('text') || t.includes('varchar') || t.includes('char') || t.includes('uuid')) return '#34d399';
  if (t.includes('bool')) return '#f59e0b';
  if (t.includes('timestamp') || t.includes('date') || t.includes('time')) return '#a78bfa';
  if (t.includes('json')) return '#f472b6';
  if (t.includes('bytea') || t.includes('blob')) return '#94a3b8';
  return 'var(--text-400)';
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.substring(0, idx)}
      <span style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.3)', color: 'var(--neon-color)' }}>
        {text.substring(idx, idx + query.length)}
      </span>
      {text.substring(idx + query.length)}
    </>
  );
};

const formatRowCount = (count: number | null | undefined): string => {
  if (count === null || count === undefined) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
};

const ColumnRow: React.FC<{ col: ColumnInfo; searchQuery: string }> = ({ col, searchQuery }) => (
  <div className="flex flex-wrap items-center gap-2 py-[4px] px-2.5 ml-6" style={{ color: 'var(--text-400)', fontSize: 'calc(var(--app-font-size, 18px) * 0.62)' }}>
    {col.isPrimaryKey ? (
      <Key size={12} className="flex-shrink-0" style={{ color: '#f59e0b' }} />
    ) : col.foreignKey ? (
      <Link2 size={12} className="flex-shrink-0" style={{ color: '#60a5fa' }} />
    ) : (
      <Hash size={12} className="flex-shrink-0 opacity-40" />
    )}
    <span className="font-mono break-all" style={{ color: 'var(--text-200)' }}>
      {highlightMatch(col.name, searchQuery)}
    </span>
    {col.foreignKey && (
      <span className="flex-shrink-0 opacity-60 break-all" style={{ color: '#60a5fa', fontSize: 'calc(var(--app-font-size, 18px) * 0.55)' }} title={`FK → ${col.foreignKey.refTable}.${col.foreignKey.refColumn}`}>
        → {col.foreignKey.refTable.split('.').pop()}
      </span>
    )}
    <span className="ml-auto flex-shrink-0 font-mono" style={{ color: getTypeColor(col.dataType), fontSize: 'calc(var(--app-font-size, 18px) * 0.58)' }}>
      {col.dataType}{col.characterMaximumLength ? `(${col.characterMaximumLength})` : ''}
    </span>
  </div>
);

const TableNode: React.FC<{
  table: TableInfo;
  searchQuery: string;
  onSelectTable: (schema: string, table: string) => void;
  onQuickAction?: (action: string, schema: string, table: string) => void;
}> = ({ table, searchQuery, onSelectTable, onQuickAction }) => {
  const [expanded, setExpanded] = useState(false);

  const matchingColumns = useMemo(() => {
    if (!searchQuery) return table.columns;
    return table.columns.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [table.columns, searchQuery]);

  const isTableMatch = !searchQuery || table.name.toLowerCase().includes(searchQuery.toLowerCase());
  const hasColumnMatch = searchQuery && matchingColumns.length > 0;

  if (searchQuery && !isTableMatch && !hasColumnMatch) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center group">
        <button
          onClick={() => setExpanded(!expanded)}
          onDoubleClick={() => onSelectTable(table.schema, table.name)}
          className="flex flex-wrap items-center gap-2 flex-1 py-[6px] px-2.5 rounded-md hover:bg-[var(--bg-200)] transition-colors cursor-pointer min-w-0"
          style={{ color: 'var(--text-200)', fontSize: 'calc(var(--app-font-size, 18px) * 0.67)' }}
        >
          {expanded ? <ChevronDown size={14} className="flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0" />}
          {table.type === 'view' ? (
            <Eye size={14} className="flex-shrink-0" style={{ color: '#a78bfa' }} />
          ) : (
            <Table2 size={14} className="flex-shrink-0" style={{ color: 'var(--neon-color)' }} />
          )}
          <span className="font-mono break-all">{highlightMatch(table.name, searchQuery)}</span>
          {table.rowCount !== null && table.rowCount !== undefined && (
            <span className="px-1 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)', fontSize: 'calc(var(--app-font-size, 18px) * 0.52)' }}>
              {formatRowCount(table.rowCount)}
            </span>
          )}
          <span className="ml-auto opacity-40 flex-shrink-0" style={{ fontSize: 'calc(var(--app-font-size, 18px) * 0.58)' }}>{table.columns.length}c</span>
        </button>
        {onQuickAction && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-1"
              >
                <FileText size={12} style={{ color: 'var(--text-400)' }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onQuickAction('select', table.schema, table.name)}>
                <FileText size={12} className="mr-2" /> SELECT * LIMIT 100
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction('count', table.schema, table.name)}>
                <BarChart3 size={12} className="mr-2" /> COUNT(*)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction('insert', table.schema, table.name)}>
                <Plus size={12} className="mr-2" /> INSERT template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction('describe', table.schema, table.name)}>
                <Table2 size={12} className="mr-2" /> Table structure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(table.schema === 'public' ? table.name : `${table.schema}.${table.name}`);
                toast.success('Copied');
              }}>
                <Copy size={12} className="mr-2" /> Copy table name
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {(expanded || hasColumnMatch) && (searchQuery ? matchingColumns : table.columns).map(col => (
        <ColumnRow key={col.name} col={col} searchQuery={searchQuery} />
      ))}
    </div>
  );
};

const DatabaseSchemaBrowser: React.FC<DatabaseSchemaBrowserProps> = ({
  schemas,
  tables,
  isLoading,
  onRefresh,
  onSelectTable,
  onQuickAction,
}) => {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSchema = (schema: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  };

  const tablesBySchema: Record<string, TableInfo[]> = {};
  for (const t of tables) {
    if (!tablesBySchema[t.schema]) tablesBySchema[t.schema] = [];
    tablesBySchema[t.schema].push(t);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-200)' }}>
        <span className="font-semibold uppercase tracking-widest" style={{ color: 'var(--text-400)', fontSize: 'calc(var(--app-font-size, 18px) * 0.6)' }}>
          Schema
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh schema"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ color: 'var(--text-400)' }} />
        </Button>
      </div>
      <div className="px-2 py-2 border-b" style={{ borderColor: 'var(--border-200)' }}>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-500)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables & columns..."
            className="w-full pl-7 pr-2 py-1.5 rounded-md border outline-none focus:border-[var(--neon-color)] transition-colors"
            style={{
              backgroundColor: 'var(--bg-200)',
              borderColor: 'var(--border-300)',
              color: 'var(--text-200)',
              fontSize: 'calc(var(--app-font-size, 18px) * 0.65)',
            }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]]:block [&>[data-radix-scroll-area-viewport]>div]:min-w-0">
        <div className="p-2">
           <div className="rounded-lg border min-w-64" style={{ borderColor: 'var(--border-200)', backgroundColor: 'var(--bg-100)' }}>
            <div className="p-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--text-400)' }} />
                </div>
              ) : schemas.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-500)', fontSize: 'calc(var(--app-font-size, 18px) * 0.65)' }}>No schemas found</div>
              ) : (
                schemas.map(schema => {
                  const schemaTables = tablesBySchema[schema] || [];
                  const isExpanded = expandedSchemas.has(schema) || !!searchQuery;
                  return (
                    <div key={schema} className="mb-1">
                      <button
                        onClick={() => toggleSchema(schema)}
                        className="flex flex-wrap items-center gap-2 w-full py-[6px] px-2 rounded-md hover:bg-[var(--bg-200)] transition-colors cursor-pointer font-semibold"
                        style={{ color: 'var(--text-300)', fontSize: 'calc(var(--app-font-size, 18px) * 0.7)' }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="font-mono break-all">{schema}</span>
                        <span className="ml-auto font-normal opacity-40" style={{ fontSize: 'calc(var(--app-font-size, 18px) * 0.58)' }}>{schemaTables.length}t</span>
                      </button>
                      {isExpanded && schemaTables.map(table => (
                        <TableNode
                          key={`${table.schema}.${table.name}`}
                          table={table}
                          searchQuery={searchQuery}
                          onSelectTable={onSelectTable}
                          onQuickAction={onQuickAction}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default DatabaseSchemaBrowser;
