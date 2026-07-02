import { cn } from "@/lib/utils";

export const SquareLoader = ({ className, size = 44 }: { className?: string; size?: number }) => {
  const scale = size / 44;
  return (
    <div
      className={cn("loader", className)}
      style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
    >
      <svg viewBox="0 0 80 80">
        <rect height="64" width="64" y="8" x="8"></rect>
      </svg>
    </div>
  );
};

export const CircleLoader = ({ className, size = 44 }: { className?: string; size?: number }) => {
  const scale = size / 44;
  return (
    <div
      className={cn("loader", className)}
      style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
    >
      <svg viewBox="0 0 80 80">
        <circle r="32" cy="40" cx="40"></circle>
      </svg>
    </div>
  );
};

export const TriangleLoader = ({ className, size = 44 }: { className?: string; size?: number }) => {
  const scale = size / 44;
  return (
    <div
      className={cn("loader triangle", className)}
      style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
    >
      <svg viewBox="0 0 86 80">
        <polygon points="43 8 79 72 7 72"></polygon>
      </svg>
    </div>
  );
};
