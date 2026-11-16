import { useEffect, useRef, useState } from 'react'
import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { FilePlus2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * `[[Título]]` links inside the editor, the way Obsidian has them: typed as
 * plain text, shown as links, opened with a click. Typing `[[` offers the
 * notes that exist. The text stays exactly what was typed — the links are a
 * way of showing it, not something stored apart from it.
 */
export interface WikiLinkSource {
  /** Whether a note with this title exists; missing ones look different. */
  exists: (title: string) => boolean
  /** Open (or create) the note a link points at. */
  open: (title: string) => void
  /** Titles to offer while typing after `[[`. */
  suggest: (query: string) => string[]
  /** Changes when the set of notes does, so links re-check what exists. */
  version: unknown
}

const key = new PluginKey<DecorationSet>('wikiLinks')
const LINK = /\[\[([^[\]\n]+?)\]\]/g

function decorate(doc: PMNode, exists: (title: string) => boolean): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const match of node.text.matchAll(LINK)) {
      const title = match[1].trim()
      const from = pos + (match.index ?? 0)
      found.push(
        Decoration.inline(from, from + match[0].length, {
          class: exists(title) ? 'wiki-link' : 'wiki-link wiki-link-missing',
          'data-wiki': title,
          title: exists(title)
            ? `Abrir “${title}” · Alt+clique para editar`
            : `Criar a nota “${title}” · Alt+clique para editar`
        })
      )
    }
  })
  return DecorationSet.create(doc, found)
}

/** The extension, reading the current source through a ref that never goes stale. */
export function wikiLinksExtension(source: { current: WikiLinkSource | undefined }): Extension {
  return Extension.create({
    name: 'wikiLinks',
    addProseMirrorPlugins() {
      const exists = (title: string): boolean => source.current?.exists(title) ?? true
      return [
        new Plugin<DecorationSet>({
          key,
          state: {
            init: (_, state: EditorState) => decorate(state.doc, exists),
            apply: (tr, old) =>
              tr.docChanged || tr.getMeta(key) ? decorate(tr.doc, exists) : old.map(tr.mapping, tr.doc)
          },
          props: {
            decorations: (state) => key.getState(state),
            handleClick: (_view, _pos, event) => {
              const link = (event.target as HTMLElement | null)?.closest?.('[data-wiki]')
              if (!link || event.altKey) return false
              source.current?.open(link.getAttribute('data-wiki') ?? '')
              return true
            }
          }
        })
      ]
    }
  })
}

/** Ask the links to look again — after a note was created, renamed or deleted. */
export function refreshWikiLinks(editor: Editor): void {
  if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(key, true))
}

interface Pending {
  /** Where the `[[` starts and where the caret is. */
  from: number
  to: number
  query: string
  left: number
  top: number
}

/** What is being typed after an open `[[`, if anything. */
function pendingLink(editor: Editor): Pending | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const $at = selection.$from
  const before = $at.parent.textBetween(0, $at.parentOffset, undefined, '￼')
  const match = /\[\[([^[\]\n]*)$/.exec(before)
  if (!match) return null
  // A `]]` already right after the caret is part of the link being finished.
  const after = $at.parent.textBetween($at.parentOffset, $at.parent.content.size, undefined, '￼')
  const coords = editor.view.coordsAtPos(selection.from)
  return {
    from: selection.from - match[0].length,
    to: selection.from + (after.startsWith(']]') ? 2 : 0),
    query: match[1],
    left: coords.left,
    top: coords.bottom + 6
  }
}

/**
 * The list under the caret after `[[`. Arrows move, Enter or Tab picks,
 * Escape closes; picking writes the whole `[[Título]]`.
 */
export function WikiSuggest({
  editor,
  source
}: {
  editor: Editor
  source: WikiLinkSource
}): JSX.Element | null {
  const [pending, setPending] = useState<Pending | null>(null)
  const [active, setActive] = useState(0)
  const dismissed = useRef<number | null>(null)

  useEffect(() => {
    const update = (): void => {
      const next = pendingLink(editor)
      // Escape hides the list until the caret leaves this link.
      if (next && dismissed.current === next.from) return setPending(null)
      dismissed.current = null
      setPending(next)
    }
    const close = (): void => setPending(null)
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    editor.on('blur', close)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
      editor.off('blur', close)
    }
  }, [editor])

  const query = pending?.query.trim() ?? ''
  const titles = pending ? source.suggest(pending.query).slice(0, 7) : []
  const canCreate = query.length > 0 && !titles.some((t) => t.toLowerCase() === query.toLowerCase())
  const options = [...titles.map((t) => ({ title: t, create: false })), ...(canCreate ? [{ title: query, create: true }] : [])]

  useEffect(() => setActive(0), [pending?.query])

  const pick = (title: string): void => {
    if (!pending) return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pending.from, to: pending.to }, { type: 'text', text: `[[${title}]]` })
      .run()
    setPending(null)
  }

  // Keys go to the list before the editor sees them. The listener is set up
  // once, so it reads everything — pick included — through this ref.
  const state = useRef({ options, active, pending, pick })
  state.current = { options, active, pending, pick }
  useEffect(() => {
    const dom = editor.view.dom
    const onKey = (e: KeyboardEvent): void => {
      const { options: opts, active: at, pending: p, pick: choose } = state.current
      if (!p || opts.length === 0) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        choose(opts[at].title)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        dismissed.current = p.from
        setPending(null)
      }
    }
    dom.addEventListener('keydown', onKey, true)
    return () => dom.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!pending || options.length === 0) return null

  return (
    <div
      className="fixed z-[80] w-72 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1 shadow-elevated"
      style={{ left: pending.left, top: pending.top }}
      // Keep the editor's focus and caret while choosing with the mouse.
      onMouseDown={(e) => e.preventDefault()}
    >
      {options.map((option, i) => (
        <button
          key={(option.create ? 'new:' : '') + option.title}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(option.title)}
          className={cn(
            'no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
            i === active ? 'bg-surface-hover text-foreground' : 'text-muted-foreground'
          )}
        >
          {option.create ? (
            <FilePlus2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {option.create ? `Ligar a uma nota nova: “${option.title}”` : option.title}
          </span>
        </button>
      ))}
    </div>
  )
}
