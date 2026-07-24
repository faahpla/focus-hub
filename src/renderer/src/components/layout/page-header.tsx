export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-end justify-between px-8 pb-6 pt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
