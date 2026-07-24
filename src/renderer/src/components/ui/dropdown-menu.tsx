import { forwardRef } from 'react'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[13rem] overflow-hidden rounded-xl border border-border bg-surface-elevated p-1.5 shadow-elevated data-[state=open]:animate-scale-in scrollbar-thin',
        className
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { active?: boolean }
>(({ className, active, children, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="flex-1 truncate">{children}</span>
    {active && <Check className="h-4 w-4 text-primary" />}
  </DropdownPrimitive.Item>
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2.5 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-border" />
}
