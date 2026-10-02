import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'synctest-'))
const out = join(dir, 'bundle.mjs')
await build({
  stdin: {
    contents: `export * from './src/main/services/sync-mapping'; export * from './src/main/services/sync-outbox'`,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'error'
})
const m = await import(pathToFileURL(out).href)

let fails = 0
const eq = (name, got, want) => {
  const a = m.sameValue(got, want) ? "=" : JSON.stringify(got), b = m.sameValue(got, want) ? "=" : JSON.stringify(want)
  if (a === b) console.log('  ok  ', name)
  else { fails++; console.log('  FAIL', name, '\n        got ', a, '\n        want', b) }
}

const card = {
  id: 'c1', boardId: 'b1', columnId: 'col1', order: 0, title: 'Video', notes: 'roteiro',
  tags: ['a'], assets: [], dueDate: '2026-10-05', createdAt: 'T0', updatedAt: 'T0'
}

console.log('diffCard')
eq('nada mudou', m.diffCard(card, { ...card }), null)
eq('so updatedAt mudou e ignorado', m.diffCard(card, { ...card, updatedAt: 'T9' }), null)
eq('titulo', m.diffCard(card, { ...card, title: 'Novo' }), { set: { title: 'Novo' }, unset: [] })
const noDue = { ...card }; delete noDue.dueDate
eq('data apagada vira unset', m.diffCard(card, noDue), { set: {}, unset: ['dueDate'] })
eq('mudou de coluna', m.diffCard(card, { ...card, columnId: 'col2', order: 3 }),
  { set: {}, unset: [], column: 'col2', order: 3 })
eq('etapa marcada (array)', m.diffCard({ ...card, checklist: [{ id: 'e', label: 'x', done: false }] },
  { ...card, checklist: [{ id: 'e', label: 'x', done: true }] }),
  { set: { checklist: [{ id: 'e', label: 'x', done: true }] }, unset: [] })

console.log('ida e volta card <-> linha')
const back = m.rowToCard({ ...m.cardToRow(card), updated_at: 'T0' })
eq('card volta igual', back, card)

console.log('jsonb devolve chaves em outra ordem');
eq('etapa com chaves reordenadas nao conta como mudanca', m.diffCard({ ...card, checklist: [{ id: 'e', label: 'x', done: false }] }, { ...card, checklist: [{ id: 'e', done: false, label: 'x' }] }), null)

console.log('mergePatch')
eq('set depois unset = unset', m.mergePatch({ set: { a: 1 }, unset: [] }, { set: {}, unset: ['a'] }),
  { set: {}, unset: ['a'] })
eq('unset depois set = set', m.mergePatch({ set: {}, unset: ['a'] }, { set: { a: 2 }, unset: [] }),
  { set: { a: 2 }, unset: [] })
eq('ordem 0 nao some', m.mergePatch({ set: {}, unset: [], order: 5 }, { set: {}, unset: [], order: 0 }),
  { set: {}, unset: [], order: 0 })

console.log('applyPatch (edicao local por cima da nuvem)')
eq('campo local ganha, resto vem da nuvem',
  m.applyPatch({ ...card, title: 'nuvem', notes: 'nuvem' }, { set: { title: 'local' }, unset: [] }),
  { ...card, title: 'local', notes: 'nuvem' })

console.log('Outbox')
const path = join(dir, 'outbox.json')
let ob = new m.Outbox(path)
ob.push({ kind: 'card-patch', id: 'c1', patch: { set: { title: 'A' }, unset: [] } })
ob.push({ kind: 'card-patch', id: 'c1', patch: { set: { notes: 'B' }, unset: [] } })
eq('dois patches do mesmo card viram um', ob.size, 1)
eq('...com os dois campos', ob.peek().patch.set, { title: 'A', notes: 'B' })

ob = new m.Outbox(path)
eq('fila sobrevive a reabrir o app', ob.size, 1)
ob.done(ob.peek())

ob.push({ kind: 'card-insert', row: m.cardToRow(card) })
ob.push({ kind: 'card-patch', id: 'c1', patch: { set: { title: 'Editado' }, unset: [] } })
eq('patch em card ainda nao enviado entra no insert', ob.size, 1)
eq('...com o titulo novo', ob.peek().row.data.title, 'Editado')
ob.push({ kind: 'card-delete', id: 'c1' })
eq('criar e apagar antes de enviar = nada a mandar', ob.size, 0)

ob.push({ kind: 'card-patch', id: 'c2', patch: { set: { title: 'x' }, unset: [] } })
ob.push({ kind: 'card-delete', id: 'c2' })
eq('apagar descarta patch pendente', ob.size, 1)
eq('...sobra so o delete', ob.peek().kind, 'card-delete')
ob.done(ob.peek())

ob.push({ kind: 'card-patch', id: 'c3', patch: { set: { title: '1' }, unset: [] } })
ob.begin(ob.peek())
ob.push({ kind: 'card-patch', id: 'c3', patch: { set: { title: '2' }, unset: [] } })
eq('nao mistura com o que ja esta sendo enviado', ob.size, 2)
eq('...o enviado continua com o valor dele', ob.peek().patch.set.title, '1')
ob.release(ob.peek())
ob.done(ob.peek()); ob.done(ob.peek())

ob.push({ kind: 'card-delete', id: 'c4' })
ob.push({ kind: 'card-insert', row: m.cardToRow({ ...card, id: 'c4' }) })
const pend = ob.pendingCards()
eq('apagar e recriar = recriado', [pend.inserts.has('c4'), pend.deletes.has('c4')], [true, false])

rmSync(dir, { recursive: true, force: true })
console.log(fails === 0 ? '\nTUDO CERTO' : `\n${fails} FALHA(S)`)
process.exit(fails === 0 ? 0 : 1)
