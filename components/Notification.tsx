import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ 
  message, 
  type, 
  onClose, 
  duration = 4000 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const isSuccess = type === 'success';
  
  return (
    <div 
      className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300"
      style={{ maxWidth: '400px' }}
    >
      <div 
        className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-sm ${
          isSuccess 
            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}
      >
        {isSuccess ? (
          <CheckCircle size={20} className="flex-shrink-0" />
        ) : (
          <XCircle size={20} className="flex-shrink-0" />
        )}
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Notification;
