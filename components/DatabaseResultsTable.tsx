import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown, Copy, Download, Check, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PAGE_SIZE = 100;

interface DatabaseResultsTableProps {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  error?: string;
  truncated?: boolean;
}

const CellValue: React.FC<{ value: any }> = ({ value }) => {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-500)', fontStyle: 'italic', opacity: 0.5 }}>NULL</span>;
  }
  if (value === '') {
    return <span style={{ color: 'var(--text-500)', fontStyle: 'italic', opacity: 0.4 }}>""</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span className="font-mono text-[11px] px-1 py-0.5 rounded" style={{
        backgroundColor: value ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
        color: value ? '#34d399' : '#f87171',
      }}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-[11px] text-right">{value.toLocaleString()}</span>;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value, null, 2);
    return (
      <span className="font-mono text-[11px]" title={str} style={{ color: '#f472b6' }}>
        {str.length > 60 ? str.substring(0, 60) + '...' : str}
      </span>
    );
  }
  const str = String(value);
  if (str.length > 120) {
    return (
      <span className="font-mono text-[11px] cursor-pointer" title={str} style={{ color: 'var(--text-200)' }}>
        {str.substring(0, 120)}...
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px]" title={str}>
      {str}
    </span>
  );
};

const DatabaseResultsTable: React.FC<DatabaseResultsTableProps> = ({
  columns,
  rows,
  rowCount,
  executionTime,
  error,
  truncated,
}) => {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizeRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const handleSort = useCallback((colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
  }, [sortCol]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    const sorted = [...rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const handleResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidths[colIdx] || 150;
    resizeRef.current = { colIdx, startX: e.clientX, startWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newWidth = Math.max(50, resizeRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colIdx]: newWidth }));
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const copyCell = useCallback((row: number, col: number) => {
    const val = rows[row]?.[col];
    const str = val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val);
    navigator.clipboard.writeText(str);
    setCopiedCell(`${row}-${col}`);
    setTimeout(() => setCopiedCell(null), 1500);
  }, [rows]);

  const copyAll = useCallback(() => {
    const tsv = [columns.join('\t'), ...rows.map(r => r.map(v => v === null ? '' : String(v)).join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv);
    toast.success('Copied to clipboard');
  }, [columns, rows]);

  const exportCSV = useCallback(() => {
    const csv = [
      columns.map(c => `"${c.replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(v => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, rows]);

  if (error) {
    return (
      <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color: '#f87171' }}>Query Error</span>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: '#fca5a5' }}>{error}</pre>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: '#34d399', color: '#34d399' }}>
            Success
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
            {rowCount} row{rowCount !== 1 ? 's' : ''} affected
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
            {executionTime}ms
          </Badge>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-medium" style={{ color: '#34d399' }}>Query executed successfully</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
              {rowCount} row{rowCount !== 1 ? 's' : ''} affected in {executionTime}ms
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
        <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
          {rowCount} row{rowCount !== 1 ? 's' : ''}
        </Badge>
        {truncated && (
          <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
            truncated
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}>
          {executionTime}ms
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAll} title="Copy all">
            <Copy size={12} style={{ color: 'var(--text-400)' }} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={exportCSV} title="Export CSV">
            <Download size={12} style={{ color: 'var(--text-400)' }} />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto border-t" style={{ borderColor: 'var(--border-200)' }}>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: 'var(--bg-200)' }}>
              <th className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold border-b w-8" style={{ borderColor: 'var(--border-200)', color: 'var(--text-500)' }}>#</th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold border-b cursor-pointer hover:bg-[var(--bg-300)] transition-colors select-none relative"
                  style={{ borderColor: 'var(--border-200)', color: 'var(--neon-color)', ...(colWidths[i] ? { width: colWidths[i], minWidth: colWidths[i], maxWidth: colWidths[i] } : {}) }}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === i && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </span>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--neon-color)] opacity-0 hover:opacity-100 z-20"
                    onMouseDown={(e) => handleResizeStart(e, i)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, ri) => {
              const actualRowIdx = page * PAGE_SIZE + ri;
              return (
                <tr
                  key={actualRowIdx}
                  className="hover:bg-[var(--bg-200)] transition-colors"
                  style={{ borderBottom: '1px solid var(--border-200)' }}
                >
                  <td className="px-2 py-1 font-mono text-[10px]" style={{ color: 'var(--text-500)' }}>{actualRowIdx + 1}</td>
                  {row.map((val, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1 cursor-pointer hover:bg-[var(--bg-300)] transition-colors break-words whitespace-normal"
                      style={{ ...(colWidths[ci] ? { maxWidth: colWidths[ci] } : { maxWidth: 300 }) }}
                      onClick={() => copyCell(actualRowIdx, ci)}
                      title="Click to copy"
                    >
                      {copiedCell === `${actualRowIdx}-${ci}` ? (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: '#34d399' }}>
                          <Check size={10} /> Copied
                        </span>
                      ) : (
                        <CellValue value={val} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: 'var(--text-500)' }}>
            Query returned no rows
          </div>
        )}
      </div>
      {sortedRows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t shrink-0" style={{ borderColor: 'var(--border-200)' }}>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedRows.length)} of {sortedRows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage(0)}
              disabled={page === 0}
              title="First page"
            >
              <ChevronLeft size={12} style={{ color: 'var(--text-400)' }} />
              <ChevronLeft size={12} style={{ color: 'var(--text-400)', marginLeft: -8 }} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              title="Previous page"
            >
              <ChevronLeft size={12} style={{ color: 'var(--text-400)' }} />
            </Button>
            <span className="text-[10px] font-mono px-1" style={{ color: 'var(--text-400)' }}>
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              title="Next page"
            >
              <ChevronRight size={12} style={{ color: 'var(--text-400)' }} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              title="Last page"
            >
              <ChevronRight size={12} style={{ color: 'var(--text-400)' }} />
              <ChevronRight size={12} style={{ color: 'var(--text-400)', marginLeft: -8 }} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseResultsTable;
