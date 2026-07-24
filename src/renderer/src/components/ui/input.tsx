import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-surface/60 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50 no-drag',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-xl border border-input bg-surface/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50 no-drag resize-none scrollbar-thin',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
