// Regenerates the app icons from build/logo.png:
//   build/icon.ico   (multi-resolution, used by the installer + exe)
//   build/icon.png   (256px)
//   resources/icon.png (256px, used by the tray + window at runtime)
// Run with: npm run icons
import Jimp from 'jimp'
import pngToIco from 'png-to-ico'
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs'

const logo = await Jimp.read('build/logo.png')
const size = Math.max(logo.bitmap.width, logo.bitmap.height)

// Square, transparent canvas with the logo centered.
const canvas = await new Promise((resolve, reject) =>
  new Jimp(size, size, 0x00000000, (err, img) => (err ? reject(err) : resolve(img)))
)
canvas.composite(
  logo,
  Math.round((size - logo.bitmap.width) / 2),
  Math.round((size - logo.bitmap.height) / 2)
)

const buffers = []
for (const s of [256, 128, 64, 48, 32, 16]) {
  buffers.push(await canvas.clone().resize(s, s).getBufferAsync(Jimp.MIME_PNG))
}

await canvas.clone().resize(256, 256).writeAsync('build/icon.png')
mkdirSync('resources', { recursive: true })
copyFileSync('build/icon.png', 'resources/icon.png')
writeFileSync('build/icon.ico', await pngToIco(buffers))

console.log('OK: build/icon.ico + build/icon.png + resources/icon.png atualizados')
