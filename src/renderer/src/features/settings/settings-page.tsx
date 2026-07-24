import { useEffect, useState } from 'react'
import { Download, Upload, Check, ShieldCheck, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { MusicSourcesEditor } from '@/features/music/music-sources-editor'
import { useAppStore } from '@/stores/app-store'
import type { ThemeName } from '@shared/types'
import { cn } from '@/lib/utils'

const THEMES: { id: ThemeName; label: string; bg: string; dot: string }[] = [
  { id: 'dark', label: 'Dark', bg: '#0a0a0f', dot: '#7c6cf6' },
  { id: 'oled', label: 'OLED', bg: '#000000', dot: '#7c6cf6' },
  { id: 'graphite', label: 'Graphite', bg: '#1a1d21', dot: '#5b8def' },
  { id: 'midnight', label: 'Midnight', bg: '#0b1020', dot: '#8b7cff' }
]

const ACCENTS = [
  '250 82% 68%', '270 80% 66%', '190 90% 60%', '152 62% 47%',
  '25 95% 60%', '340 82% 66%', '210 90% 62%', '48 96% 58%'
]

const FONTS = ['Inter', 'system-ui', 'Segoe UI', 'JetBrains Mono']

export function SettingsPage(): JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const [appInfo, setAppInfo] = useState<{ isPackaged: boolean; elevated: boolean } | null>(null)

  useEffect(() => {
    window.focusHub.getAppInfo().then(setAppInfo)
  }, [])

  const exportBackup = async (): Promise<void> => {
    await window.focusHub.exportBackup()
  }
  const importBackup = async (): Promise<void> => {
    await window.focusHub.importBackup()
  }

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Deixe o Focus HUB do seu jeito." />

      <div className="mx-auto max-w-3xl space-y-5 px-8 pb-24">
        {/* Appearance */}
        <Section title="Aparência">
          <Row label="Tema">
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => saveSettings({ theme: t.id })}
                  className={cn(
                    'relative flex h-16 w-20 flex-col items-center justify-center gap-1 rounded-xl border transition-all',
                    settings.theme === t.id ? 'border-primary' : 'border-border hover:border-border'
                  )}
                  style={{ background: t.bg }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: t.dot }} />
                  <span className="text-[11px] text-white/70">{t.label}</span>
                  {settings.theme === t.id && (
                    <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Cor principal">
            <div className="flex gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => saveSettings({ accentColor: c })}
                  className={cn(
                    'h-8 w-8 rounded-full transition-transform hover:scale-110',
                    settings.accentColor === c && 'ring-2 ring-white/80 ring-offset-2 ring-offset-background'
                  )}
                  style={{ background: `hsl(${c})` }}
                />
              ))}
            </div>
          </Row>
          <Row label="Fonte">
            <select
              value={settings.fontSans}
              onChange={(e) => saveSettings({ fontSans: e.target.value })}
              className="no-drag h-9 rounded-xl border border-input bg-surface/60 px-3 text-sm focus:outline-none focus:border-primary/60"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Formato do cronômetro">
            <div className="flex gap-1.5">
              {(['mm:ss', 'hh:mm:ss'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => saveSettings({ timerFormat: fmt })}
                  className={cn(
                    'h-9 rounded-lg px-3 text-sm transition-colors',
                    settings.timerFormat === fmt
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Behavior */}
        <Section title="Comportamento">
          <Row label="Volume principal">
            <div className="flex w-48 items-center gap-3">
              <Slider
                value={[settings.masterVolume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={([v]) => saveSettings({ masterVolume: v })}
              />
              <span className="w-8 text-right text-xs tabular text-muted-foreground">
                {Math.round(settings.masterVolume * 100)}
              </span>
            </div>
          </Row>
          <ToggleRow
            label="Notificações"
            desc="Avisos de 10, 5 e 1 minuto e fim da sessão."
            checked={settings.notificationsEnabled}
            onChange={(v) => saveSettings({ notificationsEnabled: v })}
          />
          <ToggleRow
            label="Minimizar para a bandeja"
            desc="Fechar a janela mantém o app rodando na bandeja."
            checked={settings.minimizeToTray}
            onChange={(v) => saveSettings({ minimizeToTray: v })}
          />
          <Row label="Atalho de captura">
            <kbd className="rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs tabular">
              Ctrl + Shift + Space
            </kbd>
          </Row>
        </Section>

        {/* Administrator */}
        <Section title="Administrador">
          <Row
            label="Status"
            desc="Necessário para o bloqueio de sites (edição do arquivo hosts)."
          >
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                appInfo?.elevated
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-orange-500/30 bg-orange-500/10 text-orange-400'
              )}
            >
              {appInfo?.elevated ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" /> Sem privilégios
                </>
              )}
            </span>
          </Row>
          <ToggleRow
            label="Sempre abrir como administrador"
            desc="No app instalado, pede elevação (UAC) automaticamente ao abrir."
            checked={settings.alwaysElevate}
            onChange={(v) => saveSettings({ alwaysElevate: v })}
          />
          <Row
            label="Elevar agora"
            desc={
              appInfo && !appInfo.isPackaged
                ? 'Em desenvolvimento, use o atalho start-app.bat (abre como admin).'
                : 'Reinicia o app pedindo permissão de administrador.'
            }
          >
            <Button
              variant="secondary"
              disabled={!appInfo || appInfo.elevated || !appInfo.isPackaged}
              onClick={() => window.focusHub.relaunchElevated()}
            >
              <ShieldCheck className="h-4 w-4" /> Reiniciar como admin
            </Button>
          </Row>
        </Section>

        {/* Music */}
        <Section title="Música (YouTube)">
          <MusicSourcesEditor />
        </Section>

        {/* Backup */}
        <Section title="Backup">
          <Row label="Seus dados" desc="Exporte ou restaure tudo em um arquivo JSON.">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={exportBackup}>
                <Download className="h-4 w-4" /> Exportar
              </Button>
              <Button variant="secondary" onClick={importBackup}>
                <Upload className="h-4 w-4" /> Importar
              </Button>
            </div>
          </Row>
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground">Focus HUB · v0.1.0</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </Card>
  )
}

function Row({
  label,
  desc,
  children
}: {
  label: string
  desc?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <Row label={label} desc={desc}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Row>
  )
}
