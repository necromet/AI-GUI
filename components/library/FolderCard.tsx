import React from 'react';
import { Folder, MoreVertical, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { LibraryFolder } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface FolderCardProps {
  folder: LibraryFolder;
  index: number;
  onSelect: (folder: LibraryFolder) => void;
  onEdit: (folder: LibraryFolder, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  index,
  onSelect,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      className="group relative rounded-2xl cursor-pointer transition-all duration-300 ease-out animate-fade-in"
      style={{
        backgroundColor: 'var(--bg-200)',
        border: '1px solid var(--border-300)',
        animationFillMode: 'both',
        animationDelay: `${index * 50}ms`,
      }}
      onClick={() => onSelect(folder)}
    >
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${folder.color}33, transparent 60%)`,
          borderRadius: 'inherit',
          zIndex: 0,
        }}
      />

      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              backgroundColor: `${folder.color}1a`,
              border: `1px solid ${folder.color}26`,
            }}
          >
            <Folder size={20} style={{ color: folder.color }} />
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text-500)' }}
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[160px]"
                style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
                onClick={(e) => e.stopPropagation()}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
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

        <div className="mb-4">
          <h3
            className="text-[15px] font-semibold leading-snug mb-1 line-clamp-1 group-hover:opacity-80 transition-colors duration-200"
            style={{ color: 'var(--text-100)' }}
          >
            {folder.name}
          </h3>
          {folder.description && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--text-500)' }}
            >
              {folder.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className="text-[10px] px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${folder.color}1a`, color: folder.color }}
          >
            {folder.componentCount ?? 0} component{(folder.componentCount ?? 0) !== 1 ? 's' : ''}
          </Badge>

          <ArrowUpRight
            size={14}
            className="opacity-0 group-hover:opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: 'var(--text-300)' }}
          />
        </div>
      </div>
    </div>
  );
};
