import React, { useState, useCallback } from 'react';
import {
  Folder, ChevronRight, FileCode, MoreVertical, Pencil, Trash2, Copy, Check,
  CopyPlus, FolderInput, ArrowUpRight, Loader2,
} from 'lucide-react';
import { LibraryComponent, LibraryFolder } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { CATEGORY_LABELS } from './constants';

interface ListViewProps {
  folders: LibraryFolder[];
  components: LibraryComponent[];
  copiedId: string | null;
  onSelectComponent: (comp: LibraryComponent) => void;
  onCopy: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDuplicate: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDeleteComponent: (id: string, e?: React.MouseEvent) => void;
  onEditComponent: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onMoveToFolder: (componentId: string, folderId: string | null) => void;
  onSelectFolder: (folder: LibraryFolder) => void;
  onEditFolder: (folder: LibraryFolder, e?: React.MouseEvent) => void;
  onDeleteFolder: (id: string, e?: React.MouseEvent) => void;
}

const FolderListRow: React.FC<{
  folder: LibraryFolder;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: (folder: LibraryFolder) => void;
  onEdit: (folder: LibraryFolder, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  copiedId: string | null;
  onSelectComponent: (comp: LibraryComponent) => void;
  onCopy: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDuplicate: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDeleteComponent: (id: string, e?: React.MouseEvent) => void;
  onEditComponent: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onMoveToFolder: (componentId: string, folderId: string | null) => void;
  allFolders: LibraryFolder[];
}> = ({
  folder, isExpanded, onToggle, onSelect, onEdit, onDelete,
  copiedId, onSelectComponent, onCopy, onDuplicate, onDeleteComponent,
  onEditComponent, onMoveToFolder, allFolders,
}) => {
  const [children, setChildren] = useState<LibraryComponent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    onToggle();
    if (!isExpanded && children === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/library/folders/${folder.id}/components`);
        if (res.ok) {
          const data = await res.json();
          setChildren(data.components || []);
        }
      } finally {
        setLoading(false);
      }
    }
  }, [isExpanded, children, folder.id, onToggle]);

  return (
    <>
      <div
        className="group flex items-center h-9 px-2 rounded-md cursor-pointer transition-colors duration-100"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-200)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <button
          onClick={e => { e.stopPropagation(); handleToggle(); }}
          className="flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-150"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <ChevronRight size={13} style={{ color: 'var(--text-500)' }} />
        </button>

        <div
          className="flex items-center gap-2 flex-1 min-w-0 ml-1"
          onClick={handleToggle}
        >
          <Folder size={15} style={{ color: folder.color, flexShrink: 0 }} />
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: 'var(--text-100)' }}
          >
            {folder.name}
          </span>
          <span className="text-[11px] shrink-0" style={{ color: 'var(--text-500)' }}>
            {folder.componentCount ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded"
                onClick={e => e.stopPropagation()}
                style={{ color: 'var(--text-500)' }}
              >
                <MoreVertical size={13} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[150px]"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
              onClick={e => e.stopPropagation()}
              onCloseAutoFocus={e => e.preventDefault()}
            >
              <DropdownMenuItem
                onSelect={() => onSelect(folder)}
                className="gap-2 text-xs"
                style={{ color: 'var(--text-200)' }}
              >
                <ArrowUpRight size={13} />
                Open folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onEdit(folder)}
                className="gap-2 text-xs"
                style={{ color: 'var(--text-200)' }}
              >
                <Pencil size={13} />
                Edit folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onDelete(folder.id)}
                className="gap-2 text-xs text-red-500 focus:text-red-500"
              >
                <Trash2 size={13} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isExpanded && (
        <div style={{ paddingLeft: 20 }}>
          {loading ? (
            <div className="flex items-center gap-2 h-8 px-2">
              <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-500)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>Loading...</span>
            </div>
          ) : children && children.length === 0 ? (
            <div className="h-8 flex items-center px-2">
              <span className="text-[11px] italic" style={{ color: 'var(--text-500)' }}>Empty folder</span>
            </div>
          ) : (
            children?.map((comp, idx) => (
              <ComponentListRow
                key={comp.id}
                component={comp}
                index={idx}
                copiedId={copiedId}
                onSelect={onSelectComponent}
                onCopy={onCopy}
                onDuplicate={onDuplicate}
                onDelete={onDeleteComponent}
                onEdit={onEditComponent}
                onMoveToFolder={onMoveToFolder}
                folders={allFolders}
              />
            ))
          )}
        </div>
      )}
    </>
  );
};

const ComponentListRow: React.FC<{
  component: LibraryComponent;
  index: number;
  copiedId: string | null;
  onSelect: (comp: LibraryComponent) => void;
  onCopy: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDuplicate: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  onEdit: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onMoveToFolder?: (componentId: string, folderId: string | null) => void;
  folders?: LibraryFolder[];
}> = ({
  component: comp, index, copiedId, onSelect, onCopy, onDuplicate,
  onDelete, onEdit, onMoveToFolder, folders,
}) => {
  return (
    <div
      className="group flex items-center h-9 px-2 rounded-md cursor-pointer transition-colors duration-100"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-200)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      onClick={() => onSelect(comp)}
    >
      <div className="w-5 shrink-0" />

      <FileCode size={14} style={{ color: 'var(--text-500)', flexShrink: 0 }} />

      <span
        className="text-[13px] font-medium truncate ml-2 flex-1 min-w-0"
        style={{ color: 'var(--text-100)' }}
      >
        {comp.name}
      </span>

      <Badge
        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0 rounded shrink-0 mx-2 hidden sm:inline-flex"
        style={{
          backgroundColor: 'rgba(var(--neon-rgb), 0.08)',
          color: 'var(--text-500)',
        }}
      >
        {CATEGORY_LABELS[comp.category] || comp.category}
      </Badge>

      {comp.tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1 shrink-0 mx-1">
          {comp.tags.slice(0, 2).map((tag, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-[9px] px-1 py-0 rounded"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
            >
              {tag}
            </Badge>
          ))}
          {comp.tags.length > 2 && (
            <span className="text-[9px]" style={{ color: 'var(--text-500)' }}>
              +{comp.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {comp.files && comp.files.length > 1 && (
        <div className="flex items-center gap-0.5 shrink-0 mx-1">
          <FileCode size={10} style={{ color: 'var(--text-500)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
            {comp.files.length}
          </span>
        </div>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--text-500)' }}
            >
              <MoreVertical size={13} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[150px]"
            style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
            onClick={e => e.stopPropagation()}
            onCloseAutoFocus={e => e.preventDefault()}
          >
            <DropdownMenuItem
              onSelect={() => onEdit(comp)}
              className="gap-2 text-xs"
              style={{ color: 'var(--text-200)' }}
            >
              <Pencil size={13} />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onCopy(comp)}
              className="gap-2 text-xs"
              style={{ color: 'var(--text-200)' }}
            >
              {copiedId === comp.id ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
              {copiedId === comp.id ? 'Copied!' : 'Copy content'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDuplicate(comp)}
              className="gap-2 text-xs"
              style={{ color: 'var(--text-200)' }}
            >
              <CopyPlus size={13} />
              Duplicate
            </DropdownMenuItem>
            {onMoveToFolder && folders && folders.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 text-xs" style={{ color: 'var(--text-200)' }}>
                  <FolderInput size={13} />
                  Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="min-w-[150px]"
                  style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
                >
                  {comp.folderId && (
                    <DropdownMenuItem
                      onSelect={() => onMoveToFolder(comp.id, null)}
                      className="gap-2 text-xs"
                      style={{ color: 'var(--text-200)' }}
                    >
                      <FolderInput size={13} />
                      Remove from folder
                    </DropdownMenuItem>
                  )}
                  {folders.map(f => (
                    <DropdownMenuItem
                      key={f.id}
                      onSelect={() => onMoveToFolder(comp.id, f.id)}
                      className="gap-2 text-xs"
                      style={{ color: 'var(--text-200)' }}
                      disabled={comp.folderId === f.id}
                    >
                      <FolderInput size={13} style={{ color: f.color }} />
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(comp.id)}
              className="gap-2 text-xs text-red-500 focus:text-red-500"
            >
              <Trash2 size={13} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export const ListView: React.FC<ListViewProps> = ({
  folders, components, copiedId, onSelectComponent, onCopy, onDuplicate,
  onDeleteComponent, onEditComponent, onMoveToFolder, onSelectFolder,
  onEditFolder, onDeleteFolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Column headers */}
      <div
        className="flex items-center h-8 px-2 text-[11px] font-semibold uppercase tracking-wider select-none"
        style={{ color: 'var(--text-500)', borderBottom: '1px solid var(--border-300)' }}
      >
        <div className="w-5 shrink-0" />
        <div className="w-[14px] shrink-0" />
        <div className="flex-1 ml-2">Name</div>
        <div className="w-16 text-center shrink-0 hidden sm:block">Type</div>
        <div className="w-24 shrink-0 hidden md:block">Tags</div>
        <div className="w-8 shrink-0" />
      </div>

      {/* Folders section */}
      {folders.length > 0 && (
        <>
          <div
            className="flex items-center gap-1.5 px-2 pt-3 pb-1"
          >
            <Folder size={12} style={{ color: 'var(--text-500)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
              Folders
            </span>
          </div>
          {folders.map(folder => (
            <FolderListRow
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onSelect={onSelectFolder}
              onEdit={onEditFolder}
              onDelete={onDeleteFolder}
              copiedId={copiedId}
              onSelectComponent={onSelectComponent}
              onCopy={onCopy}
              onDuplicate={onDuplicate}
              onDeleteComponent={onDeleteComponent}
              onEditComponent={onEditComponent}
              onMoveToFolder={onMoveToFolder}
              allFolders={folders}
            />
          ))}
        </>
      )}

      {/* Unfoldered components */}
      {components.length > 0 && (
        <>
          <div
            className="flex items-center gap-1.5 px-2 pt-3 pb-1"
          >
            <FileCode size={12} style={{ color: 'var(--text-500)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
              Components
            </span>
          </div>
          {components.map((comp, idx) => (
            <ComponentListRow
              key={comp.id}
              component={comp}
              index={idx}
              copiedId={copiedId}
              onSelect={onSelectComponent}
              onCopy={onCopy}
              onDuplicate={onDuplicate}
              onDelete={onDeleteComponent}
              onEdit={onEditComponent}
              onMoveToFolder={onMoveToFolder}
              folders={folders}
            />
          ))}
        </>
      )}
    </div>
  );
};
