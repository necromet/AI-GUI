import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CanvasCatalogue } from './CanvasCatalogue';

interface LibraryComponent {
  id: string;
  name: string;
  category: string;
  contentType: string;
  description: string;
  content: string;
  thumbnail?: string;
}

interface CatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCanvas: (component: LibraryComponent) => void;
}

export const CatalogueModal: React.FC<CatalogueModalProps> = ({ isOpen, onClose, onAddToCanvas }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[80vh] p-0 gap-0 overflow-hidden"
        style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
      >
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            Component Catalogue
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(80vh - 80px)' }}>
          <CanvasCatalogue onAddToCanvas={(comp) => { onAddToCanvas(comp); onClose(); }} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
