import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

const PARTICLE_COUNT = 64;
const BASE_RADIUS = 7;
const PETALS = 7;
const DETAIL = 3;
const SCALE = 3.9;
const TRAIL_SPAN = 0.38;
const ROTATION_DURATION_MS = 28000;
const PULSE_DURATION_MS = 4200;
const DURATION_MS = 4600;
const STROKE_WIDTH = 5.5;
const PATH_STEPS = 360;

function normalizeProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

function getPoint(progress: number, detailScale: number) {
  const t = normalizeProgress(progress) * Math.PI * 2;
  const x = BASE_RADIUS * Math.cos(t) - DETAIL * detailScale * Math.cos(PETALS * t);
  const y = BASE_RADIUS * Math.sin(t) - DETAIL * detailScale * Math.sin(PETALS * t);
  return { x: 50 + x * SCALE, y: 50 + y * SCALE };
}

function buildPath(detailScale: number) {
  let d = '';
  for (let i = 0; i <= PATH_STEPS; i++) {
    const p = getPoint(i / PATH_STEPS, detailScale);
    d += `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
  }
  return d;
}

function getDetailScale(time: number) {
  const pulseProgress = (time % PULSE_DURATION_MS) / PULSE_DURATION_MS;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.5 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.45;
}

function getRotation(time: number) {
  return -((time % ROTATION_DURATION_MS) / ROTATION_DURATION_MS) * 360;
}

function getParticle(index: number, progress: number, detailScale: number) {
  const tailOffset = index / (PARTICLE_COUNT - 1);
  const p = getPoint(progress - tailOffset * TRAIL_SPAN, detailScale);
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
}

export function MathCurveLoader({ size = 132, className, color }: MathCurveLoaderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<SVGCircleElement[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const init = useCallback(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;

    while (group.firstChild) group.removeChild(group.firstChild);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', String(STROKE_WIDTH));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.12');
    group.appendChild(path);
    pathRef.current = path;

    const circles: SVGCircleElement[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('fill', 'currentColor');
      group.appendChild(c);
      circles.push(c);
    }
    particlesRef.current = circles;
  }, []);

  useEffect(() => {
    init();

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;

      const progress = (elapsed % DURATION_MS) / DURATION_MS;
      const detailScale = getDetailScale(elapsed);
      const rotation = getRotation(elapsed);

      const group = groupRef.current;
      const path = pathRef.current;
      if (group) group.setAttribute('transform', `rotate(${rotation} 50 50)`);
      if (path) path.setAttribute('d', buildPath(detailScale));

      const circles = particlesRef.current;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = getParticle(i, progress, detailScale);
        const c = circles[i];
        if (c) {
          c.setAttribute('cx', p.x.toFixed(2));
          c.setAttribute('cy', p.y.toFixed(2));
          c.setAttribute('r', p.r.toFixed(2));
          c.setAttribute('opacity', p.opacity.toFixed(3));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [init]);

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
