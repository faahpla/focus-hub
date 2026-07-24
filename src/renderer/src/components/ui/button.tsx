import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none no-drag',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-glow hover:brightness-110',
        secondary:
          'bg-surface-elevated text-foreground border border-border hover:bg-surface-hover',
        ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-surface-hover',
        destructive:
          'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        subtle: 'bg-surface text-foreground hover:bg-surface-hover'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg rounded-2xl',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'

export { buttonVariants }
