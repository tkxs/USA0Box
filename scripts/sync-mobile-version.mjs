import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const version = packageJson.version
const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)

if (!match) {
  throw new Error(`Unsupported application version: ${version}`)
}

const [, major, minor, patch] = match.map(Number)
const buildNumber = major * 1_000_000 + minor * 1_000 + patch

function updateFile(relativePath, replacements) {
  const filePath = path.join(rootDir, relativePath)
  let content = fs.readFileSync(filePath, 'utf8')

  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(content)) {
      throw new Error(`Could not update ${relativePath}: ${pattern}`)
    }
    content = content.replace(pattern, replacement)
  }

  fs.writeFileSync(filePath, content)
}

updateFile('android/app/build.gradle', [
  [/versionCode \d+/, `versionCode ${buildNumber}`],
  [/versionName "[^"]+"/, `versionName "${version}"`],
])

updateFile('ios/App/App.xcodeproj/project.pbxproj', [
  [/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`],
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
])

console.log(`Mobile version synchronized: ${version} (${buildNumber})`)
