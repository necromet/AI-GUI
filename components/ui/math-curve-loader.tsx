import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type LoaderVariant = 'rose' | 'lemniscate';

const VARIANT_CONFIG: Record<LoaderVariant, {
  particleCount: number;
  trailSpan: number;
  durationMs: number;
  rotationDurationMs: number;
  pulseDurationMs: number;
  strokeWidth: number;
  rotate: boolean;
  pathSteps: number;
}> = {
  rose: {
    particleCount: 64,
    trailSpan: 0.38,
    durationMs: 4600,
    rotationDurationMs: 28000,
    pulseDurationMs: 4200,
    strokeWidth: 5.5,
    rotate: true,
    pathSteps: 360,
  },
  lemniscate: {
    particleCount: 70,
    trailSpan: 0.4,
    durationMs: 5600,
    rotationDurationMs: 34000,
    pulseDurationMs: 5000,
    strokeWidth: 4.8,
    rotate: false,
    pathSteps: 360,
  },
};

function normalizeProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

function getRosePoint(progress: number, detailScale: number) {
  const BASE_RADIUS = 7;
  const DETAIL = 3;
  const PETALS = 7;
  const SCALE = 3.9;
  const t = normalizeProgress(progress) * Math.PI * 2;
  const x = BASE_RADIUS * Math.cos(t) - DETAIL * detailScale * Math.cos(PETALS * t);
  const y = BASE_RADIUS * Math.sin(t) - DETAIL * detailScale * Math.sin(PETALS * t);
  return { x: 50 + x * SCALE, y: 50 + y * SCALE };
}

function getLemniscatePoint(progress: number, detailScale: number) {
  const A = 20;
  const BOOST = 7;
  const t = normalizeProgress(progress) * Math.PI * 2;
  const scale = A + detailScale * BOOST;
  const denom = 1 + Math.sin(t) ** 2;
  return {
    x: 50 + (scale * Math.cos(t)) / denom,
    y: 50 + (scale * Math.sin(t) * Math.cos(t)) / denom,
  };
}

function getPoint(progress: number, detailScale: number, variant: LoaderVariant) {
  return variant === 'lemniscate' ? getLemniscatePoint(progress, detailScale) : getRosePoint(progress, detailScale);
}

function buildPath(detailScale: number, variant: LoaderVariant, steps: number) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const p = getPoint(i / steps, detailScale, variant);
    d += `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
  }
  return d;
}

function getDetailScale(time: number, pulseDurationMs: number) {
  const pulseProgress = (time % pulseDurationMs) / pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.5 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.5;
}

function getRotation(time: number, rotationDurationMs: number) {
  return -((time % rotationDurationMs) / rotationDurationMs) * 360;
}

function getParticle(index: number, progress: number, detailScale: number, cfg: typeof VARIANT_CONFIG['rose']) {
  const tailOffset = index / (cfg.particleCount - 1);
  const p = getPoint(progress - tailOffset * cfg.trailSpan, detailScale, 'rose');
  const fade = Math.pow(1 - tailOffset, 0.58);
  return {
    x: p.x,
    y: p.y,
    r: 1.05 + fade * 2.75,
    opacity: 0.08 + fade * 0.92,
  };
}

export interface MathCurveLoaderProps {
  size?: number;
  className?: string;
  color?: string;
  variant?: LoaderVariant;
}

export function MathCurveLoader({ size = 132, className, color, variant = 'rose' }: MathCurveLoaderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<SVGCircleElement[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const cfg = VARIANT_CONFIG[variant];

  const init = useCallback(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;

    while (group.firstChild) group.removeChild(group.firstChild);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', String(cfg.strokeWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.12');
    group.appendChild(path);
    pathRef.current = path;

    const circles: SVGCircleElement[] = [];
    for (let i = 0; i < cfg.particleCount; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('fill', 'currentColor');
      group.appendChild(c);
      circles.push(c);
    }
    particlesRef.current = circles;
  }, [cfg.particleCount, cfg.strokeWidth]);

  useEffect(() => {
    init();

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;

      const progress = (elapsed % cfg.durationMs) / cfg.durationMs;
      const detailScale = getDetailScale(elapsed, cfg.pulseDurationMs);
      const rotation = cfg.rotate ? getRotation(elapsed, cfg.rotationDurationMs) : 0;

      const group = groupRef.current;
      const path = pathRef.current;
      if (group) group.setAttribute('transform', `rotate(${rotation} 50 50)`);
      if (path) path.setAttribute('d', buildPath(detailScale, variant, cfg.pathSteps));

      const circles = particlesRef.current;
      for (let i = 0; i < cfg.particleCount; i++) {
        const tailOffset = i / (cfg.particleCount - 1);
        const p = getPoint(progress - tailOffset * cfg.trailSpan, detailScale, variant);
        const fade = Math.pow(1 - tailOffset, 0.58);
        const c = circles[i];
        if (c) {
          c.setAttribute('cx', p.x.toFixed(2));
          c.setAttribute('cy', p.y.toFixed(2));
          c.setAttribute('r', (1.05 + fade * 2.75).toFixed(2));
          c.setAttribute('opacity', (0.08 + fade * 0.92).toFixed(3));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [init, cfg, variant]);

  return (
    <svg
      ref={svgRef}
      className={cn('overflow-visible flex-shrink-0', className)}
      style={{ color: color || 'var(--neon-color)', width: size, height: size }}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <g ref={groupRef} />
    </svg>
  );
}
