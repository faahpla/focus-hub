import { useState } from 'react'
import { Plus, Clock, ListChecks, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DynamicIcon } from '@/components/dynamic-icon'
import { ProjectEditor } from './project-editor'
import { useAppStore } from '@/stores/app-store'
import type { Project } from '@shared/types'

export function ProjectsPage(): JSX.Element {
  const allProjects = useAppStore((s) => s.projects)
  const tasks = useAppStore((s) => s.tasks)
  const projects = allProjects.filter((p) => !p.archived)
  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        title="Projetos"
        subtitle="Cada projeto é um ambiente de trabalho completo."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo projeto
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 px-8 pb-24 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, i) => {
          const projectTasks = tasks.filter((t) => t.projectId === project.id)
          const doneTasks = projectTasks.filter((t) => t.status === 'done').length
          return (
            <motion.button
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setEditing(project)}
              className="no-drag group relative overflow-hidden rounded-2xl border border-border/70 bg-surface/60 p-5 text-left transition-colors hover:border-border hover:bg-surface-hover"
            >
              <div
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: `hsl(${project.color})` }}
              />
              <div className="relative mb-4 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `hsl(${project.color} / 0.16)` }}
                >
                  <DynamicIcon
                    name={project.icon}
                    className="h-5 w-5"
                    style={{ color: `hsl(${project.color})` }}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{project.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.description || 'Sem descrição'}
                  </p>
                </div>
              </div>

              <div className="relative flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Clock className="h-3 w-3" /> {project.defaultDurationMinutes}min
                </Badge>
                <Badge variant="outline">
                  <ListChecks className="h-3 w-3" /> {doneTasks}/{projectTasks.length}
                </Badge>
                {project.flow.ultraFocus && (
                  <Badge variant="primary">
                    <Sparkles className="h-3 w-3" /> Ultra
                  </Badge>
                )}
                {project.flow.blockSites.length > 0 && (
                  <Badge variant="default">{project.flow.blockSites.length} bloqueios</Badge>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {(editing || creating) && (
        <ProjectEditor
          project={editing}
          open
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}
