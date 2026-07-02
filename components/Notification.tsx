import React, { useEffect, useState } from 'react';
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
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 16);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [duration, onClose]);

  const isSuccess = type === 'success';

  return (
    <div
      className={`fixed top-4 right-4 z-[100] transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-2 opacity-0 scale-95'}`}
      style={{ maxWidth: '400px' }}
    >
      <div
        className={`relative flex items-center gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden ${
          isSuccess
            ? 'border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.08]'
            : 'border border-red-500/20 bg-red-50 dark:bg-red-500/[0.08]'
        }`}
        style={{ boxShadow: `0 10px 40px -10px rgba(0,0,0,0.5)` }}
      >
        {isSuccess ? (
          <CheckCircle size={18} className="flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
        ) : (
          <XCircle size={18} className="flex-shrink-0 text-red-500 dark:text-red-400" />
        )}
        <p className={`flex-1 text-base font-medium ${isSuccess ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{message}</p>
        <button
          onClick={() => { setIsVisible(false); setTimeout(onClose, 200); }}
          className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
          <div
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              background: isSuccess
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #ef4444, #f87171)',
              opacity: 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Notification;
