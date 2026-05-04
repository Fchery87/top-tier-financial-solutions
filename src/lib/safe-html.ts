const allowedTags = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h2',
  'h3',
  'h4',
]);

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi, (tag, tagName: string) => {
      const normalizedTag = tagName.toLowerCase();
      if (!allowedTags.has(normalizedTag)) return '';
      return tag.startsWith('</') ? `</${normalizedTag}>` : `<${normalizedTag}>`;
    });
}
