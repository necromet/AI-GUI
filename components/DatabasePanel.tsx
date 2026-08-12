import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Database, Plus, Trash2, Play, Loader2, History, X, Server, Clock, Pencil, AlertTriangle, StopCircle, Wand2, WrapText, Type, HelpCircle, Loader2 as LoaderIcon } from 'lucide-react';

const ExplainCanvas = lazy(() => import('./actuallyexplain/ExplainCanvas'));
import { format } from 'sql-formatter';
import { DatabaseConnection, SchemaInfo, QueryResult } from '../types';
import * as db from '../services/apiDatabaseAdapter';
import DatabaseConnectForm from './DatabaseConnectForm';
import DatabaseSchemaBrowser from './DatabaseSchemaBrowser';
import DatabaseResultsTable from './DatabaseResultsTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export interface DatabaseSidebarControls {
  schemas: string[];
  tables: import('../types').TableInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTable: (schemaName: string, tableName: string) => void;
  onQuickAction: (action: string, schemaName: string, tableName: string) => void;
}

export interface DatabaseHeaderControls {
  sql: string;
  lastExecTime: number | null;
  fontSize: number;
  wordWrap: boolean;
  isExecuting: boolean;
  showHistory: boolean;
  showShortcuts: boolean;
  onFormatSql: () => void;
  onClear: () => void;
  onToggleWordWrap: () => void;
  onChangeFontSize: (delta: number) => void;
  onExecute: () => void;
  onCancelExecution: () => void;
  onToggleHistory: () => void;
  onToggleShortcuts: (show: boolean) => void;
}

interface DatabasePanelProps {
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSidebarControls?: (controls: DatabaseSidebarControls | null) => void;
  onHeaderControls?: (controls: DatabaseHeaderControls | null) => void;
}

interface QueryHistoryEntry {
  sql: string;
  timestamp: number;
  executionTime: number;
  rowCount: number;
  error?: string;
}

const HISTORY_STORAGE_KEY = 'edward:labs_dbQueryHistory';
const MAX_HISTORY = 50;

function loadHistory(): QueryHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: QueryHistoryEntry[]) {
  try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch {}
}

const DatabasePanel: React.FC<DatabasePanelProps> = ({
  theme,
  onNotification,
  isSidebarOpen,
  onToggleSidebar,
  onSidebarControls,
  onHeaderControls,
}) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activeConnectionName, setActiveConnectionName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editConnection, setEditConnection] = useState<any>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const [schema, setSchema] = useState<SchemaInfo>({ schemas: [], tables: [] });
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<QueryHistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [schemaPanelCollapsed, setSchemaPanelCollapsed] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; sql: string; warning: string }>({ open: false, sql: '', warning: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; connId: string; connName: string }>({ open: false, connId: '', connName: '' });
  const [lastExecTime, setLastExecTime] = useState<number | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'checking' | 'reachable' | 'unreachable'>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [editorSplitRatio, setEditorSplitRatio] = useState(() => {
    try { return parseFloat(localStorage.getItem('edward:labs_dbEditorSplit') || '0.45'); } catch { return 0.45; }
  });
  const [schemaWidth, setSchemaWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('edward:labs_dbSchemaWidth') || '240', 10); } catch { return 240; }
  });
  const [cursorOffset, setCursorOffset] = useState<number | null>(null);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const rawEditorRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const completionDisposableRef = useRef<any>(null);
  const schemaRef = useRef<SchemaInfo>({ schemas: [], tables: [] });

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (activeConnectionId) {
      loadSchema();
    }
  }, [activeConnectionId]);

  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    if (!onSidebarControls) return;
    if (activeConnectionId) {
      onSidebarControls({
        schemas: schema.schemas,
        tables: schema.tables,
        isLoading: isLoadingSchema,
        onRefresh: loadSchema,
        onSelectTable: handleSelectTable,
        onQuickAction: handleQuickAction,
      });
    } else {
      onSidebarControls(null);
    }
  }, [activeConnectionId, schema, isLoadingSchema]);

  useEffect(() => {
    if (!onHeaderControls) return;
    if (activeConnectionId) {
      onHeaderControls({
        sql,
        lastExecTime,
        fontSize,
        wordWrap,
        isExecuting,
        showHistory,
        showShortcuts,
        onFormatSql: formatSql,
        onClear: () => { setSql(''); setQueryResult(null); },
        onToggleWordWrap: toggleWordWrap,
        onChangeFontSize: changeFontSize,
        onExecute: () => executeQuery(),
        onCancelExecution: cancelExecution,
        onToggleHistory: () => setShowHistory(!showHistory),
        onToggleShortcuts: setShowShortcuts,
      });
    } else {
      onHeaderControls(null);
    }
  }, [activeConnectionId, sql, lastExecTime, fontSize, wordWrap, isExecuting, showHistory, showShortcuts]);

  useEffect(() => {
    if (rawEditorRef.current && monacoRef.current) {
      registerCompletionProvider(monacoRef.current);
    }
  }, [schema]);

  const loadConnections = async () => {
    try {
      setIsLoadingConnections(true);
      const conns = await db.getDbConnections();
      setConnections(conns);
      for (const conn of conns) {
        setConnectionStatuses(prev => ({ ...prev, [conn.id]: 'checking' }));
        db.pingDbConnection(conn.id).then(result => {
          setConnectionStatuses(prev => ({ ...prev, [conn.id]: result.reachable ? 'reachable' : 'unreachable' }));
        }).catch(() => {
          setConnectionStatuses(prev => ({ ...prev, [conn.id]: 'unreachable' }));
        });
      }
    } catch (err: any) {
      onNotification?.('Failed to load connections: ' + err.message, 'error');
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const loadSchema = async () => {
    if (!activeConnectionId) return;
    try {
      setIsLoadingSchema(true);
      const result = await db.getDbSchema(activeConnectionId);
      setSchema(result);
    } catch (err: any) {
      onNotification?.('Failed to load schema: ' + err.message, 'error');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'ON',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'GROUP', 'BY', 'ORDER',
    'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
    'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'IF', 'EXISTS',
    'BETWEEN', 'LIKE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'DISTINCT',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE',
    'CASCADE', 'TRUNCATE', 'RETURNING', 'WITH', 'RECURSIVE', 'LATERAL', 'FETCH', 'NEXT',
    'ROWS', 'ONLY', 'FOR', 'NOWAIT', 'SKIP', 'LOCKED', 'EXPLAIN', 'ANALYZE',
  ];

  const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'LOWER', 'UPPER', 'TRIM', 'LTRIM', 'RTRIM', 'LENGTH', 'SUBSTRING', 'REPLACE',
    'CONCAT', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'EXTRACT', 'DATE_PART',
    'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'AGE', 'ROUND', 'CEIL', 'FLOOR', 'ABS',
    'MOD', 'POWER', 'SQRT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG',
    'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'STRING_AGG', 'ARRAY_AGG', 'JSONB_AGG',
    'JSON_BUILD_OBJECT', 'JSONB_BUILD_OBJECT', 'EXISTS', 'ANY', 'SOME', 'GREATEST',
    'LEAST', 'GENERATE_SERIES', 'UNNEST', 'ARRAY_LENGTH', 'PG_SIZE_PRETTY',
  ];

  const registerCompletionProvider = (monaco: any) => {
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const currentSchema = schemaRef.current;
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];

        for (const t of currentSchema.tables) {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Struct,
            insertText: t.schema === 'public' ? t.name : `${t.schema}.${t.name}`,
            detail: `${t.type} (${t.schema})`,
            range,
          });
          for (const c of t.columns) {
            suggestions.push({
              label: `${t.name}.${c.name}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: c.name,
              detail: `${c.dataType}${c.isPrimaryKey ? ' PK' : ''}`,
              range,
            });
          }
        }

        for (const kw of SQL_KEYWORDS) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        }

        for (const fn of SQL_FUNCTIONS) {
          suggestions.push({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${fn}($1)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          });
        }

        return { suggestions };
      },
    });
  };

  const defineEdwardTheme = (monaco: any) => {
    monaco.editor.defineTheme('edward-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'f87171', fontStyle: 'bold' },
        { token: 'keyword.sql', foreground: 'f87171', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'string.sql', foreground: '34d399' },
        { token: 'number', foreground: '60a5fa' },
        { token: 'comment', foreground: '7a7a7a', fontStyle: 'italic' },
        { token: 'operator.sql', foreground: 'f472b6' },
        { token: 'predefined.sql', foreground: 'a78bfa' },
        { token: 'type', foreground: 'fbbf24' },
      ],
      colors: {
        'editor.background': '#0e0e0e',
        'editor.foreground': '#ececec',
        'editor.lineHighlightBackground': '#1a1a1a',
        'editor.selectionBackground': '#252525',
        'editor.inactiveSelectionBackground': '#1a1a1a',
        'editorCursor.foreground': '#f87171',
        'editorLineNumber.foreground': '#4a4a4a',
        'editorLineNumber.activeForeground': '#ececec',
        'editorIndentGuide.background': '#1a1a1a',
        'editorIndentGuide.activeBackground': '#252525',
        'editorSuggestWidget.background': '#1a1a1a',
        'editorSuggestWidget.border': '#252525',
        'editorSuggestWidget.selectedBackground': '#252525',
        'editorWidget.background': '#1a1a1a',
        'editorWidget.border': '#252525',
      },
    });
  };

  const handleConnect = async (conn: { name: string; host: string; port: number; database: string; user: string; password: string; ssl: boolean }) => {
    try {
      setIsConnecting(true);
      let id: string;
      if (editConnection?.id) {
        const updates: any = { name: conn.name, host: conn.host, port: conn.port, database: conn.database, user: conn.user, ssl: conn.ssl };
        if (conn.password) updates.password = conn.password;
        await db.updateDbConnection(editConnection.id, updates);
        id = editConnection.id;
        await loadConnections();
      } else {
        id = await db.saveDbConnection(conn);
        await loadConnections();
      }
      setActiveConnectionId(id);
      setActiveConnectionName(conn.name);
      setShowForm(false);
      setEditConnection(null);
      setSql('');
      setQueryResult(null);
      setSchema({ schemas: [], tables: [] });
      onNotification?.(`Connected to ${conn.name}`, 'success');
    } catch (err: any) {
      onNotification?.('Failed to save connection: ' + err.message, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickConnect = async (conn: DatabaseConnection) => {
    setActiveConnectionId(conn.id);
    setActiveConnectionName(conn.name);
    setSql('');
    setQueryResult(null);
    setSchema({ schemas: [], tables: [] });
  };

  const handleDisconnect = () => {
    if (activeConnectionId) {
      db.releaseDbPool(activeConnectionId).catch(() => {});
    }
    setActiveConnectionId(null);
    setActiveConnectionName('');
    setSchema({ schemas: [], tables: [] });
    setQueryResult(null);
    setSql('');
  };

  const handleDeleteConnection = async (id: string, name: string) => {
    setDeleteDialog({ open: true, connId: id, connName: name });
  };

  const confirmDeleteConnection = async () => {
    try {
      await db.deleteDbConnection(deleteDialog.connId);
      await loadConnections();
      if (activeConnectionId === deleteDialog.connId) handleDisconnect();
      onNotification?.('Connection deleted', 'success');
    } catch (err: any) {
      onNotification?.('Failed to delete: ' + err.message, 'error');
    } finally {
      setDeleteDialog({ open: false, connId: '', connName: '' });
    }
  };

  const handleEditConnection = (conn: DatabaseConnection) => {
    setEditConnection({ id: conn.id, name: conn.name, host: conn.host, port: conn.port, database: conn.database, user: conn.user, ssl: conn.ssl });
    setShowForm(true);
  };

  const handleSelectTable = useCallback((schemaName: string, tableName: string) => {
    const newSql = `SELECT *\nFROM ${schemaName === 'public' ? '' : schemaName + '.'}${tableName}\nLIMIT 100;`;
    setSql(newSql);
    setQueryResult(null);
  }, []);

  const handleQuickAction = useCallback((action: string, schemaName: string, tableName: string) => {
    const qualifiedName = schemaName === 'public' ? tableName : `${schemaName}.${tableName}`;
    switch (action) {
      case 'select':
        setSql(`SELECT *\nFROM ${qualifiedName}\nLIMIT 100;`);
        break;
      case 'count':
        setSql(`SELECT COUNT(*) AS total\nFROM ${qualifiedName};`);
        break;
      case 'insert':
        setSql(`INSERT INTO ${qualifiedName} ()\nVALUES ();`);
        break;
      case 'describe': {
        const table = schema.tables.find(t => t.schema === schemaName && t.name === tableName);
        if (table) {
          const lines = table.columns.map(c =>
            `  ${c.name} ${c.dataType}${c.characterMaximumLength ? `(${c.characterMaximumLength})` : ''}${c.isNullable ? '' : ' NOT NULL'}${c.columnDefault ? ` DEFAULT ${c.columnDefault}` : ''}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}`
          );
          setSql(`-- Table structure for ${qualifiedName}\n-- Columns: ${table.columns.length}\n-- Rows: ${table.rowCount ?? 'unknown'}\n\nCREATE TABLE ${qualifiedName} (\n${lines.join(',\n')}\n);`);
        }
        break;
      }
    }
    setQueryResult(null);
  }, [schema.tables]);

  const executeQuery = useCallback(async (forceSql?: string) => {
    if (!activeConnectionId || (!sql.trim() && !forceSql) || isExecuting) return;
    const sqlToRun = forceSql || sql.trim();

    const cleaned = sqlToRun.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!/^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i.test(cleaned)) {
      toast.error('Only SELECT queries are allowed in read-only mode');
      return;
    }

    try {
      setIsExecuting(true);
      setQueryResult(null);
      abortRef.current = new AbortController();
      const result = await db.executeDbQuery(activeConnectionId, sqlToRun, undefined, true);
      abortRef.current = null;

      setQueryResult(result);
      setLastExecTime(result.executionTime);

      const entry: QueryHistoryEntry = {
        sql: sqlToRun,
        timestamp: Date.now(),
        executionTime: result.executionTime,
        rowCount: result.rowCount,
        error: result.error,
      };
      const newHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      saveHistory(newHistory);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onNotification?.('Query failed: ' + err.message, 'error');
      }
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [activeConnectionId, sql, isExecuting, history, onNotification]);

  const cancelExecution = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsExecuting(false);
      toast.info('Query cancelled');
    }
  }, []);

  const confirmDestructiveQuery = useCallback(() => {
    setConfirmDialog({ open: false, sql: '', warning: '' });
  }, [confirmDialog.sql]);

  const formatSql = useCallback(() => {
    try {
      const formatted = format(sql, { language: 'postgresql', keywordCase: 'upper' });
      setSql(formatted);
      toast.success('SQL formatted');
    } catch {
      toast.error('Could not format SQL');
    }
  }, [sql]);

  const toggleWordWrap = useCallback(() => {
    setWordWrap(prev => {
      const next = !prev;
      if (rawEditorRef.current) {
        rawEditorRef.current.updateOptions({ wordWrap: next ? 'on' : 'off' });
      }
      return next;
    });
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    setFontSize(prev => {
      const next = Math.min(24, Math.max(10, prev + delta));
      if (rawEditorRef.current) {
        rawEditorRef.current.updateOptions({ fontSize: next });
      }
      return next;
    });
  }, []);

  const handleEditorSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).closest('.flex-col.flex-1.min-h-0');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMouseMove = (ev: MouseEvent) => {
      const ratio = Math.min(0.85, Math.max(0.15, (ev.clientY - rect.top) / rect.height));
      setEditorSplitRatio(ratio);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      try { localStorage.setItem('edward:labs_dbEditorSplit', String(editorSplitRatio)); } catch {}
      if (rawEditorRef.current) rawEditorRef.current.layout();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [editorSplitRatio]);

  const handleExplainHighlight = useCallback((range: { start: number; end: number }) => {
    const editor = rawEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    const startPos = model.getPositionAt(range.start);
    const endPos = model.getPositionAt(range.end);
    const selection = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
    editor.setSelection(selection);
    editor.revealRangeInCenter(selection);
  }, []);

  const handleSchemaResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = schemaWidth;
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(500, Math.max(150, startWidth + (ev.clientX - startX)));
      setSchemaWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      try { localStorage.setItem('edward:labs_dbSchemaWidth', String(schemaWidth)); } catch {}
      if (rawEditorRef.current) rawEditorRef.current.layout();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [schemaWidth]);

  const handleEditorMount = useCallback((editor: any, monaco?: any) => {
    editorRef.current = editor;
    rawEditorRef.current = editor;
    monacoRef.current = monaco;
    if (monaco && editor) {
      defineEdwardTheme(monaco);
      monaco.editor.setTheme('edward-dark');
      registerCompletionProvider(monaco);
      editor.addAction({
        id: 'execute-query',
        label: 'Execute Query',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => executeQuery(),
      });
      editor.addAction({
        id: 'format-sql',
        label: 'Format SQL',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
        run: () => formatSql(),
      });
      editor.onDidChangeCursorPosition((e: any) => {
        const model = editor.getModel();
        if (!model) return;
        const offset = model.getOffsetAt(e.position);
        setCursorOffset(offset);
      });
    }
  }, [executeQuery]);

  // Connection list view (not connected)
  if (!activeConnectionId) {
    return (
      <div className="h-full flex flex-col animate-fade-in">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
                <Database size={28} style={{ color: 'var(--neon-color)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-100)' }}>Database Explorer</h2>
              <p className="text-sm" style={{ color: 'var(--text-500)' }}>Connect to PostgreSQL databases and explore with SQL</p>
            </div>

            <Button
              onClick={() => { setEditConnection(null); setShowForm(true); }}
              className="w-full mb-6 cursor-pointer"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              <Plus size={16} className="mr-2" /> New Connection
            </Button>

            {isLoadingConnections ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-400)' }} />
              </div>
            ) : connections.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-400)' }}>
                  Saved Connections
                </span>
                {connections.map(conn => (
                  <div
                    key={conn.id}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:border-[rgba(var(--neon-rgb),0.3)] cursor-pointer group"
                    style={{ backgroundColor: 'rgba(20,20,20,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}
                    onClick={() => handleQuickConnect(conn)}
                  >
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}>
                      <Server size={16} style={{ color: 'var(--neon-color)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: connectionStatuses[conn.id] === 'reachable' ? '#34d399'
                              : connectionStatuses[conn.id] === 'unreachable' ? '#f87171'
                              : connectionStatuses[conn.id] === 'checking' ? '#fbbf24'
                              : 'var(--text-500)',
                          }}
                        />
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-100)' }}>{conn.name}</div>
                      </div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-500)' }}>
                        {conn.host}:{conn.port}/{conn.database}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleEditConnection(conn); }}
                      title="Edit"
                    >
                      <Pencil size={13} style={{ color: 'var(--text-400)' }} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id, conn.name); }}
                      title="Delete"
                    >
                      <Trash2 size={13} style={{ color: '#f87171' }} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs" style={{ color: 'var(--text-500)' }}>No saved connections</p>
              </div>
            )}
          </div>
        </div>

        <DatabaseConnectForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleConnect}
          initialData={editConnection}
        />
      </div>
    );
  }

  // Connected view
  return (
      <div className="flex-1 flex flex-col animate-fade-in min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {isExecuting && (
            <div className="h-0.5 w-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-200)' }}>
              <div className="h-full animate-pulse" style={{ backgroundColor: 'var(--neon-color)', width: '100%' }} />
            </div>
          )}

          {/* Editor + Explain side by side */}
          <div className={`flex flex-col min-h-0 ${queryResult ? '' : 'flex-1'}`} style={queryResult ? { flex: editorSplitRatio, minHeight: '200px' } : { minHeight: '200px' }}>
            <div className="flex-1 flex min-h-0">
              {/* SQL Editor (left) */}
              <div className="flex-1 min-w-0 flex flex-col relative border-r" style={{ borderColor: 'var(--border-200)' }}>
                <CodeEditor
                  language="sql"
                  value={sql}
                  onChange={setSql}
                  onLoad={handleEditorMount}
                  placeholder="SELECT * FROM table_name LIMIT 100;"
                />
                {showHistory && (
                  <div className="absolute inset-0 z-20 flex flex-col" style={{ backgroundColor: 'var(--bg-100)' }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-200)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-300)' }}>Query History</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowHistory(false)}>
                        <X size={12} style={{ color: 'var(--text-400)' }} />
                      </Button>
                    </div>
                    <ScrollArea className="flex-1">
                      {history.length === 0 ? (
                        <div className="text-center py-8 text-xs" style={{ color: 'var(--text-500)' }}>No history yet</div>
                      ) : (
                        history.map((entry, i) => (
                          <div
                            key={i}
                            className="w-full text-left px-3 py-2 border-b hover:bg-[var(--bg-200)] transition-colors"
                            style={{ borderColor: 'var(--border-200)' }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {entry.error ? (
                                <Badge variant="outline" className="text-[9px]" style={{ borderColor: '#f87171', color: '#f87171' }}>error</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
                                  {entry.rowCount} rows
                                </Badge>
                              )}
                              <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-500)' }}>
                                <Clock size={10} /> {entry.executionTime}ms
                              </span>
                              <span className="text-[10px] ml-auto" style={{ color: 'var(--text-500)' }}>
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <pre className="text-[11px] font-mono truncate mb-1" style={{ color: 'var(--text-300)' }}>
                              {entry.sql}
                            </pre>
                            <button
                              onClick={() => { setSql(entry.sql); setShowHistory(false); }}
                              className="text-[10px] cursor-pointer hover:underline"
                              style={{ color: 'var(--neon-color)' }}
                            >
                              Copy to editor
                            </button>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Explain Canvas (right) */}
              <div className="flex-1 min-w-0 min-h-0">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--text-500)' }}>
                    <LoaderIcon size={16} className="animate-spin" />
                    <span className="text-xs">Loading Visual Explain...</span>
                  </div>
                }>
                  <ExplainCanvas
                    sql={sql}
                    onHighlight={handleExplainHighlight}
                    cursorOffset={cursorOffset}
                  />
                </Suspense>
              </div>
            </div>
          </div>

          {/* Results */}
          {queryResult && (
            <>
              <div
                className="h-1.5 flex-shrink-0 cursor-row-resize hover:bg-[var(--neon-color)] transition-colors opacity-0 hover:opacity-100"
                style={{ backgroundColor: 'var(--border-200)' }}
                onMouseDown={handleEditorSplitDrag}
              />
              <div ref={resultRef} className="flex-1 min-h-0 border-t" style={{ borderColor: 'var(--border-200)' }}>
              <DatabaseResultsTable
                columns={queryResult.columns}
                rows={queryResult.rows}
                rowCount={queryResult.rowCount}
                executionTime={queryResult.executionTime}
                error={queryResult.error}
                truncated={(queryResult as any).truncated}
              />
              </div>
            </>
          )}
        </div>

      <DatabaseConnectForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditConnection(null); }}
        onSave={handleConnect}
        initialData={editConnection}
      />

      {/* Destructive query confirmation dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, sql: '', warning: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              Confirm Destructive Query
            </DialogTitle>
            <DialogDescription>{confirmDialog.warning}</DialogDescription>
          </DialogHeader>
          <pre className="text-xs font-mono p-2 rounded" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>
            {confirmDialog.sql}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, sql: '', warning: '' })} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={confirmDestructiveQuery} style={{ backgroundColor: '#f59e0b', color: '#000' }} className="cursor-pointer">
              Execute Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete connection confirmation dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, connId: '', connName: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={18} style={{ color: '#f87171' }} />
              Delete Connection
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.connName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, connId: '', connName: '' })} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteConnection} className="cursor-pointer">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle size={18} style={{ color: 'var(--neon-color)' }} />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {[
              ['Ctrl+Enter', 'Execute query'],
              ['Ctrl+Shift+F', 'Format SQL'],
              ['Ctrl+Z', 'Undo'],
              ['Ctrl+Shift+Z', 'Redo'],
              ['Ctrl+/', 'Toggle comment'],
              ['Ctrl+D', 'Select next occurrence'],
              ['Escape', 'Cancel / Close panels'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-xs" style={{ color: 'var(--text-300)' }}>{desc}</span>
                <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
                  {key}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabasePanel;
