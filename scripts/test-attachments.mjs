// Rules for attachment names, types and lifetime.
// Run: node scripts/test-attachments.mjs
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'atttest-'))
const out = join(dir, 'bundle.mjs')
await build({
  entryPoints: ['src/main/services/attachment-files.ts'],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'error'
})
const m = await import(pathToFileURL(out).href)

let fails = 0
const eq = (name, got, want) => {
  if (got === want) console.log('  ok  ', name)
  else {
    fails++
    console.log('  FAIL', name, '| got', JSON.stringify(got), '| want', JSON.stringify(want))
  }
}

eq('chave tira acento e emoji', m.storageKeyOf('B', 'id1', 'Narração Final 🔥.mp3'), 'B/id1__Narracao_Final_.mp3')
eq('chave de nome so com emoji', m.storageKeyOf('B', 'id1', '🔥🔥'), 'B/id1__arquivo')
eq('chave guarda a extensao', m.storageKeyOf('B', 'id1', '🔥.png'), 'B/id1__.png')
eq('pasta tira caractere proibido', m.folderNameOf('Rimuru: o VILÃO? 😱'), 'Rimuru o VILÃO 😱')
eq('pasta sem ponto no fim', m.folderNameOf('Fim...'), 'Fim')
eq('pasta nunca vazia', m.folderNameOf('???'), 'Card')
eq('arquivo longo mantem extensao', m.fileNameOf('a'.repeat(300) + '.mp3').endsWith('.mp3'), true)
eq('arquivo de outro sistema', m.fileNameOf('cap:1/thumb?.png'), 'cap_1_thumb_.png')
eq('tipo do mp3', m.contentTypeOf('x.MP3'), 'audio/mpeg')
eq('tipo do txt', m.contentTypeOf('notas.txt'), 'text/plain; charset=utf-8')
eq('tipo desconhecido', m.contentTypeOf('projeto.drp'), 'application/octet-stream')
eq('2 dias em ms', m.ATTACHMENT_TTL_MS, 172800000)
eq('limite de 10 MB', m.MAX_ATTACHMENT_BYTES, 10485760)

rmSync(dir, { recursive: true, force: true })
console.log(fails === 0 ? '\nTUDO CERTO' : `\n${fails} FALHA(S)`)
process.exit(fails === 0 ? 0 : 1)
