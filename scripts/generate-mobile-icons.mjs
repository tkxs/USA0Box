import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const resources = path.join(root, 'resources')
const androidManifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
const foregroundPath = path.join(resources, 'icon-foreground.png')
const backgroundPath = path.join(resources, 'icon-background.png')
const iconOnlyPath = path.join(resources, 'icon-only.png')
const backgroundColor = { r: 232, g: 236, b: 243, alpha: 1 }

const background = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: backgroundColor },
})
  .png()
  .toBuffer()

await sharp(background).toFile(backgroundPath)
await sharp(background).composite([{ input: foregroundPath, gravity: 'centre' }]).png().toFile(iconOnlyPath)

const assetsCli = path.join(root, 'node_modules', '@capacitor', 'assets', 'bin', 'capacitor-assets')
const androidManifest = fs.readFileSync(androidManifestPath)
execFileSync(process.execPath, [assetsCli, 'generate', '--ios', '--android'], { cwd: root, stdio: 'inherit' })
fs.writeFileSync(androidManifestPath, androidManifest)

const legacySizes = {
  ldpi: 36,
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

for (const [density, size] of Object.entries(legacySizes)) {
  const markSize = Math.round(size * 0.88)
  const mark = await sharp(foregroundPath).resize(markSize, markSize, { fit: 'contain' }).png().toBuffer()
  const transparentIcon = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer()
  const directory = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`)
  fs.writeFileSync(path.join(directory, 'ic_launcher.png'), transparentIcon)
  fs.writeFileSync(path.join(directory, 'ic_launcher_round.png'), transparentIcon)
}

console.log('Generated mobile icons with transparent Android legacy icons and an opaque iOS-safe background.')
