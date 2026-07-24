import { icons, type LucideProps } from 'lucide-react'
import { Folder } from 'lucide-react'

/** Renders a Lucide icon by its PascalCase name, falling back to Folder. */
export function DynamicIcon({ name, ...props }: { name: string } & LucideProps): JSX.Element {
  const Cmp = (icons as Record<string, React.ComponentType<LucideProps>>)[name] ?? Folder
  return <Cmp {...props} />
}

export const PROJECT_ICONS = [
  'Clapperboard', 'Film', 'Video', 'Music', 'Mic', 'Code', 'Terminal',
  'PenTool', 'Palette', 'Brush', 'Camera', 'Gamepad2', 'BookOpen',
  'GraduationCap', 'Briefcase', 'Rocket', 'Sparkles', 'Target', 'Zap',
  'Brain', 'Lightbulb', 'FolderKanban', 'FileText', 'Newspaper'
]
