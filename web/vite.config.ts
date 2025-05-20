import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function loadRootWebEnv() {
  const envPath = path.resolve(__dirname, '../.env.web')
  if (!fs.existsSync(envPath)) {
    return {}
  }

  const envFile = fs.readFileSync(envPath, 'utf8')
  const entries = envFile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return null
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      return [key, value] as const
    })
    .filter((entry): entry is readonly [string, string] => entry !== null)

  return Object.fromEntries(entries)
}

const rootWebEnv = loadRootWebEnv()

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      rootWebEnv.VITE_API_BASE_URL ?? 'http://localhost:8000',
    ),
    'import.meta.env.VITE_TRAINING_WS_URL': JSON.stringify(
      rootWebEnv.VITE_TRAINING_WS_URL ?? 'ws://localhost:8000/ws/training',
    ),
    'import.meta.env.VITE_COMPETE_WS_URL': JSON.stringify(
      rootWebEnv.VITE_COMPETE_WS_URL ?? 'ws://localhost:8000/ws/compete',
    ),
  },
})
