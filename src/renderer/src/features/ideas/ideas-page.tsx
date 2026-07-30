import { useEffect, useRef, useState } from 'react'
import { Check, Lightbulb, Pencil, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { useAppStore } from '@/stores/app-store'
import { formatDate } from '@/lib/format'
import type { Idea } from '@shared/types'
import { cn } from '@/lib/utils'

export function IdeasPage(): JSX.Element {
  const allIdeas = useAppStore((s) => s.ideas)
  const deleteIdea = useAppStore((s) => s.deleteIdea)
  const [editingId, setEditingId] = useState<string | null>(null)
  const ideas = allIdeas.filter((i) => !i.archived)

  return (
    <div>
      <PageHeader
        title="Ideias"
        subtitle="Tudo que passou pela sua cabeça, sem quebrar o foco."
      />
      <div className="px-8 pb-24">
        {ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Nenhuma ideia ainda</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Use o botão flutuante ou o atalho global{' '}
              <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px]">
                Ctrl+Shift+Space
              </kbd>{' '}
              para capturar sem sair do foco.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {ideas.map((idea) => (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    'group relative rounded-2xl border bg-surface/60 p-4 transition-colors',
                    editingId === idea.id
                      ? 'border-primary/60'
                      : 'border-border/70 hover:border-border'
                  )}
                >
                  {editingId === idea.id ? (
                    <IdeaEditor idea={idea} onDone={() => setEditingId(null)} />
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingId(idea.id)}
                        className="no-drag block w-full text-left"
                        title="Clique para editar"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {idea.content}
                        </p>
                      </button>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(idea.createdAt)}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setEditingId(idea.id)}
                            className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteIdea(idea.id)}
                            className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Inline editor for one idea. Enter saves, Shift+Enter breaks the line, Esc
 * cancels — an empty result is treated as a cancel so a stray Enter can't wipe
 * a captured thought.
 */
function IdeaEditor({ idea, onDone }: { idea: Idea; onDone: () => void }): JSX.Element {
  const saveIdea = useAppStore((s) => s.saveIdea)
  const [draft, setDraft] = useState(idea.content)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Focus at the end of the text and size the box to fit what's there.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [])

  const save = (): void => {
    const content = draft.trim()
    if (content && content !== idea.content) void saveIdea({ ...idea, content })
    onDone()
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          e.currentTarget.style.height = 'auto'
          e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 320)}px`
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onDone()
          }
        }}
        placeholder="Escreva sua ideia…"
        className="no-drag min-h-[72px] w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none scrollbar-thin"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Enter salva · Shift+Enter quebra linha · Esc cancela
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDone}
            className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={save}
            className="no-drag flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-all hover:brightness-110"
          >
            <Check className="h-3.5 w-3.5" /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
