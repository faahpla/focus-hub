# Focus HUB

O **cockpit de foco** para mentes TDAH. Não é mais um Pomodoro: você escolhe um
projeto, clica em **Iniciar Sessão** e o computador inteiro se transforma no
ambiente ideal de trabalho — fecha distrações, abre programas e arquivos,
bloqueia sites, liga a música ambiente e entra no modo Ultra Focus. Tudo em um
clique.

Desktop premium para Windows, inspirado em Raycast, Linear, Arc e Cursor.

## Stack

Electron · React · TypeScript · Vite (electron-vite) · TailwindCSS · Framer
Motion · Zustand · React Router · Radix UI · electron-store.

## Rodando

```bash
npm install
# o ambiente pode bloquear postinstall; se o Electron não baixar:
node node_modules/electron/install.js
npm run dev
```

Outros scripts:

```bash
npm run build        # build de produção (out/)
npm run typecheck    # checagem de tipos (main + renderer)
npm run dist:win     # empacota instalador NSIS para Windows
```

> **Bloqueio de sites** edita o arquivo `hosts` do Windows e por isso exige
> executar o app **como administrador**. Sem elevação, todas as outras etapas do
> Modo Flow funcionam normalmente e o app avisa o que não conseguiu aplicar.

## Arquitetura

Clean Architecture com separação estrita entre processos:

```
src/
  shared/                 Contrato de domínio + canais IPC (fonte única de verdade)
    types.ts              Project, Task, Idea, Session, Stats, Settings, FlowConfig
    ipc.ts                Constantes de canal + interface FocusHubApi

  main/                   Processo Electron (Node)
    index.ts              Ciclo de vida, bandeja, atalhos globais, single-instance
    store/repository.ts   Repository Pattern sobre electron-store (+ XP/streak/heatmap)
    services/flow-service.ts  Integração com o SO (fechar/abrir apps, hosts, DND)
    windows/              WindowManager (janela principal + captura rápida)
    ipc/register-ipc.ts   Wire de todos os handlers

  preload/index.ts        Bridge seguro (contextIsolation) expondo window.focusHub

  renderer/src/           React
    stores/               Zustand: app-store (dados), session-store (timer), ambient
    components/ui/         Design System (Button, Card, Dialog, Slider, ...)
    components/layout/     TitleBar, Sidebar, AppShell
    features/
      home/               Home: tarefa atual, timer gigante, controles, rail de stats
      session/            TimerDisplay, ChecklistPanel, Ultra Focus overlay
      projects/           CRUD de projetos + editor de Modo Flow + tarefas
      ideas/              Captura de ideias
      quick-capture/      Botão flutuante + janela dedicada (atalho global)
      ambient/            Motor de som ambiente (Web Audio, gerado offline)
      stats/              Métricas, heatmap estilo GitHub, XP/nível, conquistas
      settings/           Temas, cores, fonte, backup
    styles/globals.css    Tokens do Design System + 4 temas (Dark/OLED/Graphite/Midnight)
```

### Fluxo de uma sessão

1. `HomePage` configura a sessão (projeto + tarefa + duração) via `session-store`.
2. `start()` chama `window.focusHub.applyFlow(project.flow)` → `FlowService` monta o
   ambiente no SO e retorna o que foi aplicado (com avisos honestos).
3. O timer roda sem drift (baseado em wall-clock) e dispara notificações em 10/5/1 min.
4. `stop()` grava a `Session` no `Repository`, que atualiza XP, nível, streak,
   heatmap e conquistas em uma passada, e libera o ambiente (`releaseFlow`).

## Atalhos globais

| Atalho | Ação |
| --- | --- |
| `Ctrl + Shift + Space` | Capturar ideia (janela flutuante) |
| `Ctrl + Shift + P` | Pausar / retomar a sessão |

## Status

Fundação funcional: loop completo Home → Sessão → Flow → Ultra Focus → estatísticas,
projetos, ideias, temas e backup. Próximos passos em `ROADMAP` abaixo.

### Roadmap

- [x] Drag-and-drop de tarefas e checklist (@dnd-kit, ordem persistida)
- [ ] Agendamento automático de bloqueios por horário
- [x] Relatório de fim de sessão (resumo + XP animado + conquistas)
- [x] Música via playlists do YouTube (mini-player persistente, troca de playlists)
- [ ] Sons ambientes com samples reais (opt-in, baixados sob demanda)
- [ ] Sincronização/backup automático agendado
- [ ] Ícone e assets finais + empacotamento assinado
