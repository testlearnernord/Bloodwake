const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const htmlEscape = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
