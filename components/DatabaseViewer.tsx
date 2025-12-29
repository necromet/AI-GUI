import React, { useState, useEffect } from 'react';
import { Database, Table, Search, Play, Info, Trash2, RefreshCw } from 'lucide-react';

interface DatabaseStats {
  models: number;
  conversations: number;
  messages: number;
  databaseSize: number;
  databasePath: string;
}

const DatabaseViewer: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

  useEffect(() => {
    if (isElectron) {
      loadStats();
      loadTables();
    }
  }, [isElectron]);

  const loadStats = async () => {
    if (!isElectron) return;
    try {
      const stats = await window.electron.getDatabaseStats();
      setStats(stats);
    } catch (err: any) {
      setError(`Failed to load stats: ${err.message}`);
    }
  };

  const loadTables = async () => {
    if (!isElectron) return;
    try {
      const tables = await window.electron.getAllTables();
      setTables(tables);
    } catch (err: any) {
      setError(`Failed to load tables: ${err.message}`);
    }
  };

  const loadTableData = async (tableName: string) => {
    if (!isElectron) return;
    setLoading(true);
    setError(null);
    try {
      // Properly quote table names to handle case-sensitive names
      const result = await window.electron.executeQuery(`SELECT * FROM "${tableName}"`);
      if (result.success) {
        setTableData(result.data || []);
        const schema = await window.electron.getTableSchema(tableName);
        setTableSchema(schema);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(`Failed to load table data: ${err.message}`);
    }
    setLoading(false);
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setQueryResult(null);
    loadTableData(tableName);
  };

  const executeCustomQuery = async () => {
    if (!isElectron || !customQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.executeQuery(customQuery);
      if (result.success) {
        setQueryResult(result.data);
        setSelectedTable('');
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err: any) {
      setError(`Query error: ${err.message}`);
    }
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (!isElectron) {
    return (
      <div className="flex items-center justify-center h-screen bg-main text-gray-400">
        <div className="text-center">
          <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Database Viewer is only available in Electron mode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-main text-gray-100">
      {/* Sidebar - Tables List */}
      <div className="w-64 bg-sidebar border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 neon-text" />
            <h2 className="text-lg font-semibold">Database</h2>
          </div>
          <button
            onClick={loadStats}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-input hover:bg-hover rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 border-b border-gray-800 text-sm space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 neon-text" />
              <span className="font-semibold">Statistics</span>
            </div>
            <div className="space-y-1 text-gray-400">
              <div>Models: <span className="neon-text">{stats.models}</span></div>
              <div>Conversations: <span className="neon-text">{stats.conversations}</span></div>
              <div>Messages: <span className="neon-text">{stats.messages}</span></div>
              <div>Size: <span className="neon-text">{formatBytes(stats.databaseSize)}</span></div>
            </div>
          </div>
        )}

        {/* Tables */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-400">
            <Table className="w-4 h-4" />
            Tables
          </div>
          <div className="space-y-1">
            {tables.map((table) => (
              <button
                key={table}
                onClick={() => handleTableSelect(table)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedTable === table
                    ? 'bg-input neon-text'
                    : 'hover:bg-hover text-gray-300'
                }`}
              >
                {table}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Query Input */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-5 h-5 neon-text" />
            <h3 className="font-semibold">Custom Query</h3>
            <span className="text-xs text-gray-500">(SELECT only)</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeCustomQuery()}
              placeholder="SELECT * FROM Messages WHERE role = 'user'"
              className="flex-1 px-4 py-2 bg-input border border-gray-700 rounded-lg focus:outline-none focus:neon-border"
            />
            <button
              onClick={executeCustomQuery}
              disabled={loading || !customQuery.trim()}
              className="px-4 py-2 bg-input hover:bg-hover neon-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Table Schema */}
              {selectedTable && tableSchema.length > 0 && (
                <div className="mb-4 p-4 bg-input rounded-lg border border-gray-800">
                  <h4 className="font-semibold mb-2 neon-text">Schema: {selectedTable}</h4>
                  <div className="text-sm text-gray-400 space-y-1">
                    {tableSchema.map((col: any) => (
                      <div key={col.cid}>
                        <span className="text-gray-300">{col.name}</span>
                        <span className="text-gray-500"> ({col.type})</span>
                        {col.pk === 1 && <span className="ml-2 text-xs neon-text">PRIMARY KEY</span>}
                        {col.notnull === 1 && <span className="ml-2 text-xs text-yellow-400">NOT NULL</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Table */}
              {(tableData.length > 0 || queryResult) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {Object.keys((queryResult || tableData)[0] || {}).map((key) => (
                          <th key={key} className="text-left p-2 font-semibold neon-text">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(queryResult || tableData).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-hover">
                          {Object.values(row).map((value: any, vidx: number) => (
                            <td key={vidx} className="p-2 text-gray-300">
                              {value === null ? (
                                <span className="text-gray-600 italic">NULL</span>
                              ) : typeof value === 'string' && value.length > 100 ? (
                                <span title={value}>{value.substring(0, 100)}...</span>
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-xs text-gray-500">
                    {(queryResult || tableData).length} row(s)
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && !selectedTable && !queryResult && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <Table className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select a table or run a custom query</p>
                  </div>
                </div>
              )}

              {selectedTable && tableData.length === 0 && !queryResult && !loading && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>Table is empty</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Database Path */}
        {stats && (
          <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
            <span className="font-semibold">Database Path:</span> {stats.databasePath}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseViewer;
