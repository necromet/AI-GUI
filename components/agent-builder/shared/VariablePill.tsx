import { Fragment } from 'react';

const VARIABLE_PATTERN = /(\{\{\s*[^{}]+?\s*\}\})/g;
const COMPLETE_VARIABLE_PATTERN = /^\{\{\s*[^{}]+?\s*\}\}$/;

export function hasVariableToken(value: string) {
  return /\{\{\s*[^{}]+?\s*\}\}/.test(value);
}

export default function VariablePillText({ value, className = '', maskPlain = false, compact = false }: { value: string; className?: string; maskPlain?: boolean; compact?: boolean }) {
  return (
    <span className={className}>
      {value.split(VARIABLE_PATTERN).map((part, index) => (
        COMPLETE_VARIABLE_PATTERN.test(part) ? (
          <span
            key={`${part}-${index}`}
            className={`rounded-[4px] align-baseline ${compact ? '' : 'mx-px px-[2px]'}`}
            style={{
              color: 'var(--neon-color)',
              background: 'rgba(var(--neon-rgb), 0.14)',
              boxShadow: '0 0 0 1px rgba(var(--neon-rgb), 0.28)',
              lineHeight: 'inherit',
              verticalAlign: 'baseline',
              margin: compact ? 0 : undefined,
              padding: compact ? 0 : undefined,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {part}
          </span>
        ) : <Fragment key={index}>{maskPlain ? part.replace(/[^\s]/g, '\u2022') : part}</Fragment>
      ))}
    </span>
  );
}
