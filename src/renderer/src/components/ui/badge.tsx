import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-elevated text-muted-foreground border border-border',
        primary: 'bg-primary/15 text-primary border border-primary/25',
        success: 'bg-success/15 text-success border border-success/25',
        destructive: 'bg-destructive/15 text-destructive border border-destructive/25',
        outline: 'border border-border text-muted-foreground'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
