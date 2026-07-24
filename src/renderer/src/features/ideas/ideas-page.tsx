import { Lightbulb, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { useAppStore } from '@/stores/app-store'
import { formatDate } from '@/lib/format'

export function IdeasPage(): JSX.Element {
  const allIdeas = useAppStore((s) => s.ideas)
  const deleteIdea = useAppStore((s) => s.deleteIdea)
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
                  className="group relative rounded-2xl border border-border/70 bg-surface/60 p-4"
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {idea.content}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(idea.createdAt)}
                    </span>
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
