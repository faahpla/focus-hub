/**
 * The card's long texts — Roteiro, Resumo, B-roll — are stored as the
 * editor's HTML once formatted, and as plain text before that.
 *
 * Plain text is never reinterpreted: a line like "Ep. 1 — …" or "19." stays
 * exactly that, instead of being read as Markdown and turned into a list (the
 * Markdown route was tried and dropped words from real scripts). Old texts are
 * shown one paragraph per line, so blank lines survive as they were, and only
 * become HTML when edited.
 */

const RICH_START = /^\s*<(p|h[1-6]|ul|ol|blockquote|hr)[\s>/]/i

export function isRichText(value: string): boolean {
  return RICH_START.test(value)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** What to load into the editor: HTML as is, plain text one paragraph per line. */
export function toEditorHtml(value: string): string {
  if (!value) return ''
  if (isRichText(value)) return value
  return value
    .split(/\r\n?|\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

/** Inline text of an element, with <br> as a line break. */
function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeName === 'BR') return '\n'
  return Array.from(node.childNodes).map(inlineText).join('')
}

function blockLines(parent: Element, out: string[], indent = ''): void {
  for (const el of Array.from(parent.children)) {
    const tag = el.tagName
    if (tag === 'UL' || tag === 'OL') {
      const start = Number(el.getAttribute('start') ?? 1)
      Array.from(el.children).forEach((li, i) => {
        const marker = tag === 'OL' ? `${start + i}. ` : '- '
        const inner: string[] = []
        blockLines(li, inner, indent + '  ')
        // A list item holds a paragraph; nested lists come after it, indented.
        const [first = '', ...rest] = inner.length ? inner : [inlineText(li)]
        out.push(indent + marker + first.trimStart(), ...rest)
      })
    } else if (tag === 'BLOCKQUOTE') {
      blockLines(el, out, indent)
    } else if (tag === 'HR') {
      out.push(indent + '---')
    } else {
      out.push(...inlineText(el).split('\n').map((line) => indent + line))
    }
  }
}

/**
 * Readable plain text of either form — for copying into places that take no
 * formatting, counting words, and the one-line preview on the board.
 */
export function toPlainText(value: string): string {
  if (!value || !isRichText(value)) return value
  const doc = new DOMParser().parseFromString(value, 'text/html')
  const out: string[] = []
  blockLines(doc.body, out)
  return out.join('\n')
}

/**
 * Copy with both flavours on the clipboard: Docs or Notion keep the bold and
 * the titles, TikTok or YouTube get clean text without any markup.
 */
export async function copyRichText(value: string): Promise<void> {
  const plain = toPlainText(value)
  if (!isRichText(value)) {
    await navigator.clipboard.writeText(plain)
    return
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([plain], { type: 'text/plain' }),
      'text/html': new Blob([value], { type: 'text/html' })
    })
  ])
}
