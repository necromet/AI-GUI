import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'pre', 'code', 'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup',
      'blockquote', 'details', 'summary', 'figure', 'figcaption',
      'style', 'path', 'svg', 'button', 'input', 'select', 'option', 'textarea',
      'label', 'form', 'section', 'article', 'nav', 'header', 'footer', 'main',
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'href', 'src', 'alt', 'title', 'target',
      'rel', 'type', 'value', 'placeholder', 'disabled', 'checked',
      'data-*', 'aria-*', 'role', 'width', 'height', 'viewBox',
      'd', 'fill', 'stroke', 'stroke-width', 'xmlns',
    ],
    ALLOW_DATA_ATTR: true,
  });
}
