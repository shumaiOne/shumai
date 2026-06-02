import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { expand as dotenvExpand } from 'dotenv-expand'

export type Env = { [key: string]: string | undefined }
export type LoadedEnvFiles = Array<{
  path: string
  contents: string
  env: Env
}>

let initialEnv: Env | undefined = undefined
let combinedEnv: Env | undefined = undefined
let cachedLoadedEnvFiles: LoadedEnvFiles = []

type Log = {
  info: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function replaceProcessEnv(sourceEnv: Env) {
  Object.keys(process.env).forEach((key) => {
    if (sourceEnv[key] === undefined || sourceEnv[key] === '') {
      delete process.env[key]
    }
  })

  Object.entries(sourceEnv).forEach(([key, value]) => {
    process.env[key] = value
  })
}

export function processEnv(loadedEnvFiles: LoadedEnvFiles, dir?: string, log: Log = console) {
  if (!initialEnv) {
    initialEnv = Object.assign({}, process.env)
  }

  const origEnv = Object.assign({}, initialEnv)
  const parsed: dotenv.DotenvParseOutput = {}

  for (const envFile of loadedEnvFiles) {
    try {
      const result: dotenv.DotenvConfigOutput = {}
      result.parsed = dotenv.parse(envFile.contents)

      const expandResult = dotenvExpand(result)
      const parsedResult = expandResult.parsed
      if (parsedResult) {
        for (const key of Object.keys(parsedResult)) {
          if (typeof parsed[key] === 'undefined' && typeof origEnv[key] === 'undefined') {
            parsed[key] = parsedResult[key]
          }
        }
      }

      envFile.env = result.parsed || {}
    } catch (err) {
      log.error(`Failed to load env from ${path.join(dir || '', envFile.path)}`, err)
    }
  }

  return Object.assign(process.env, parsed)
}

export function loadEnvConfig(
  dir: string,
  dev?: boolean,
  log: Log = console,
): {
  combinedEnv: Env
  loadedEnvFiles: LoadedEnvFiles
} {
  if (!initialEnv) {
    initialEnv = Object.assign({}, process.env)
  }

  if (combinedEnv) {
    return { combinedEnv, loadedEnvFiles: cachedLoadedEnvFiles }
  }

  replaceProcessEnv(initialEnv)
  cachedLoadedEnvFiles = []

  const isTest = process.env.NODE_ENV === 'test'
  const mode = isTest ? 'test' : dev ? 'development' : 'production'
  const dotenvFiles = [
    `.env.${mode}.local`,
    mode !== 'test' && `.env.local`,
    `.env.${mode}`,
    '.env',
  ].filter(Boolean) as string[]

  for (const envFile of dotenvFiles) {
    const dotEnvPath = path.join(dir, envFile)

    try {
      const stats = fs.statSync(dotEnvPath)

      if (!stats.isFile() && !stats.isFIFO()) {
        continue
      }

      const contents = fs.readFileSync(dotEnvPath, 'utf8')
      cachedLoadedEnvFiles.push({
        path: envFile,
        contents,
        env: {},
      })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        log.error(`Failed to load env from ${envFile}`, err)
      }
    }
  }

  combinedEnv = processEnv(cachedLoadedEnvFiles, dir, log)

  return { combinedEnv, loadedEnvFiles: cachedLoadedEnvFiles }
}
