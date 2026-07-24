import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'

export function QuickCaptureButton(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const saveIdea = useAppStore((s) => s.saveIdea)

  const submit = (): void => {
    const content = value.trim()
    if (!content) return
    void saveIdea({ id: uid(), content, createdAt: new Date().toISOString(), archived: false })
    setValue('')
    setOpen(false)
  }

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 22 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="no-drag absolute bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-glow"
      >
        <Lightbulb className="h-4 w-4" />
        Capturar ideia
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-w-xl p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            Nova ideia · Enter para salvar
          </div>
          <Textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="O que passou pela sua cabeça?"
            className="min-h-[96px] border-0 bg-transparent text-base focus-visible:ring-0"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
