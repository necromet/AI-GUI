import type { NoteBlock } from '../../types';

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

function parseInlineContent(text: string): TipTapNode[] {
  if (!text) return [{ type: 'text', text: '' }];

  const nodes: TipTapNode[] = [];
  let remaining = text;

  const patterns: Array<{
    regex: RegExp;
    handler: (match: RegExpMatchArray) => { consumed: string; node: TipTapNode };
  }> = [
    {
      regex: /^\*\*(.+?)\*\*/,
      handler: (m) => ({
        consumed: m[0],
        node: { type: 'text', text: m[1], marks: [{ type: 'bold' }] },
      }),
    },
    {
      regex: /^\*(.+?)\*/,
      handler: (m) => ({
        consumed: m[0],
        node: { type: 'text', text: m[1], marks: [{ type: 'italic' }] },
      }),
    },
    {
      regex: /^~~(.+?)~~/,
      handler: (m) => ({
        consumed: m[0],
        node: { type: 'text', text: m[1], marks: [{ type: 'strike' }] },
      }),
    },
    {
      regex: /^`(.+?)`/,
      handler: (m) => ({
        consumed: m[0],
        node: { type: 'text', text: m[1], marks: [{ type: 'code' }] },
      }),
    },
    {
      regex: /^==(.+?)==/,
      handler: (m) => ({
        consumed: m[0],
        node: { type: 'text', text: m[1], marks: [{ type: 'highlight' }] },
      }),
    },
    {
      regex: /^\[(.+?)\]\((.+?)\)/,
      handler: (m) => ({
        consumed: m[0],
        node: {
          type: 'text',
          text: m[1],
          marks: [{ type: 'link', attrs: { href: m[2] } }],
        },
      }),
    },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, handler } of patterns) {
      const match = remaining.match(regex);
      if (match) {
        const { consumed, node } = handler(match);
        nodes.push(node);
        remaining = remaining.slice(consumed.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const nextSpecial = remaining.search(/[*~=`\[]/);
      if (nextSpecial === -1) {
        nodes.push({ type: 'text', text: remaining });
        break;
      }
      if (nextSpecial > 0) {
        nodes.push({ type: 'text', text: remaining.slice(0, nextSpecial) });
        remaining = remaining.slice(nextSpecial);
      } else {
        nodes.push({ type: 'text', text: remaining[0] });
        remaining = remaining.slice(1);
      }
    }
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }];
}

function makeParagraph(text: string): TipTapNode {
  return {
    type: 'paragraph',
    content: parseInlineContent(text),
  };
}

function convertBlock(block: NoteBlock): TipTapNode[] {
  switch (block.type) {
    case 'heading1':
      return [{ type: 'heading', attrs: { level: 1 }, content: parseInlineContent(block.content) }];
    case 'heading2':
      return [{ type: 'heading', attrs: { level: 2 }, content: parseInlineContent(block.content) }];
    case 'heading3':
      return [{ type: 'heading', attrs: { level: 3 }, content: parseInlineContent(block.content) }];
    case 'bullet_list':
      return [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [makeParagraph(block.content)] },
          ],
        },
      ];
    case 'numbered_list':
      return [
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [makeParagraph(block.content)] },
          ],
        },
      ];
    case 'todo':
      return [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: block.props?.checked ?? false },
              content: [makeParagraph(block.content)],
            },
          ],
        },
      ];
    case 'toggle': {
      const childContent: TipTapNode[] = [makeParagraph(block.content)];
      if (block.children?.length) {
        for (const child of block.children) {
          childContent.push(...convertBlock(child));
        }
      }
      return [
        {
          type: 'toggle',
          attrs: { open: !(block.props?.collapsed ?? false) },
          content: childContent,
        },
      ];
    }
    case 'code':
      return [
        {
          type: 'codeBlock',
          attrs: { language: block.props?.language || 'javascript' },
          content: block.content ? [{ type: 'text', text: block.content }] : [],
        },
      ];
    case 'callout': {
      const calloutContent: TipTapNode[] = block.content
        ? [makeParagraph(block.content)]
        : [{ type: 'paragraph' }];
      return [
        {
          type: 'callout',
          attrs: { emoji: block.props?.emoji || '💡' },
          content: calloutContent,
        },
      ];
    }
    case 'quote':
      return [
        {
          type: 'blockquote',
          content: [makeParagraph(block.content)],
        },
      ];
    case 'divider':
      return [{ type: 'horizontalRule' }];
    case 'image':
      return [
        {
          type: 'image',
          attrs: {
            src: block.props?.imageUrl || '',
            alt: block.props?.caption || '',
            title: block.props?.caption || null,
          },
        },
      ];
    case 'paragraph':
    default:
      return [makeParagraph(block.content)];
  }
}

export function migrateBlocks(blocks: NoteBlock[]): TipTapDocument {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const content: TipTapNode[] = [];
  for (const block of blocks) {
    content.push(...convertBlock(block));
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

export function isLegacyBlocks(data: unknown): data is NoteBlock[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return (
    typeof data[0] === 'object' &&
    data[0] !== null &&
    'type' in data[0] &&
    'content' in data[0] &&
    typeof data[0].type === 'string' &&
    ['paragraph', 'heading1', 'heading2', 'heading3', 'bullet_list', 'numbered_list', 'todo', 'toggle', 'code', 'callout', 'quote', 'divider', 'image'].includes(data[0].type)
  );
}

export function isTipTapDocument(data: unknown): data is TipTapDocument {
  if (!data || typeof data !== 'object') return false;
  const doc = data as Record<string, unknown>;
  return doc.type === 'doc' && Array.isArray(doc.content);
}
