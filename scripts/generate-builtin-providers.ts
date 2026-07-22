import * as fs from 'fs'
import * as path from 'path'

export const PRIORITY_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'groq',
  'openrouter',
  'mistral',
  'amazon-bedrock',
]

const envMap: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  'github-copilot': 'COPILOT_GITHUB_TOKEN',
  'azure-openai-responses': 'AZURE_OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  google: 'GEMINI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'vercel-ai-gateway': 'AI_GATEWAY_API_KEY',
  zai: 'ZAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  'minimax-cn': 'MINIMAX_CN_API_KEY',
  moonshotai: 'MOONSHOT_API_KEY',
  'moonshotai-cn': 'MOONSHOT_API_KEY',
  huggingface: 'HF_TOKEN',
  fireworks: 'FIREWORKS_API_KEY',
  together: 'TOGETHER_API_KEY',
  opencode: 'OPENCODE_API_KEY',
  'opencode-go': 'OPENCODE_API_KEY',
  'kimi-coding': 'KIMI_API_KEY',
  'cloudflare-workers-ai': 'CLOUDFLARE_API_KEY',
  'cloudflare-ai-gateway': 'CLOUDFLARE_API_KEY',
  xiaomi: 'XIAOMI_API_KEY',
  'xiaomi-token-plan-cn': 'XIAOMI_TOKEN_PLAN_CN_API_KEY',
  'xiaomi-token-plan-ams': 'XIAOMI_TOKEN_PLAN_AMS_API_KEY',
  'xiaomi-token-plan-sgp': 'XIAOMI_TOKEN_PLAN_SGP_API_KEY',
}

export function sortProviders(entries: [string, unknown][]): [string, unknown][] {
  return entries.sort(([a], [b]) => {
    const indexA = PRIORITY_PROVIDERS.indexOf(a)
    const indexB = PRIORITY_PROVIDERS.indexOf(b)

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return a.localeCompare(b)
  })
}

function toIdentifier(name: string): string {
  const camel = name.replace(/-([a-z0-9])/g, (_, g) => g.toUpperCase())
  return camel.replace(/[^a-zA-Z0-9_$]/g, '_')
}

async function loadModelData(): Promise<Record<string, unknown>> {
  // Check local pi-mono data directory first
  const piMonoDataDir = path.resolve(
    process.cwd(),
    '..',
    'pi-mono',
    'packages',
    'ai',
    'src',
    'providers',
    'data',
  )
  if (fs.existsSync(piMonoDataDir)) {
    console.log(`Loading model data from local pi-mono workspace: ${piMonoDataDir}`)
    const files = fs
      .readdirSync(piMonoDataDir)
      .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    const rawProviders: Record<string, unknown> = {}
    for (const file of files) {
      const providerName = path.basename(file, '.json')
      const filePath = path.join(piMonoDataDir, file)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      rawProviders[providerName] = content
    }
    return rawProviders
  }

  console.log('Local pi-mono data directory not found, fetching from models.dev API...')
  const res = await fetch('https://models.dev/api/v1/models')
  if (!res.ok) {
    throw new Error(`Failed to fetch models from models.dev: ${res.statusText}`)
  }
  const data = (await res.json()) as Record<string, unknown>
  return data
}

async function sync() {
  console.log('Loading pi model data...')
  const rawModels = await loadModelData()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: Record<string, any> = {}
  const sortedEntries = sortProviders(Object.entries(rawModels))

  for (const [providerName, models] of sortedEntries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelList = Object.values(models as Record<string, any>)
    if (modelList.length === 0) continue

    const firstModel = modelList[0]
    providers[providerName] = {
      name: providerName,
      config: {
        api: firstModel.api,
        baseUrl: firstModel.baseUrl,
        apiKey: envMap[providerName] || '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      models: modelList.map((m: any) => ({
        modelId: m.id,
        name: m.name,
        config: {
          api: m.api,
          reasoning: m.reasoning,
          input: m.input,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
          cost: m.cost,
        },
      })),
    }
  }

  const generatedDir = path.join(process.cwd(), 'packages', 'core', 'src', 'generated')
  const providersSubdir = path.join(generatedDir, 'providers')

  if (!fs.existsSync(providersSubdir)) {
    fs.mkdirSync(providersSubdir, { recursive: true })
  }

  // Clean existing files in providers directory
  const existingSubFiles = fs.readdirSync(providersSubdir)
  for (const file of existingSubFiles) {
    if (file.endsWith('.ts')) {
      fs.unlinkSync(path.join(providersSubdir, file))
    }
  }

  // Write individual provider files
  const importStatements: string[] = []
  const providerEntries: string[] = []

  for (const [providerName, providerData] of Object.entries(providers)) {
    const filePath = path.join(providersSubdir, `${providerName}.ts`)
    const fileContent = `// This file is auto-generated by scripts/generate-builtin-providers.ts
// Do not edit manually - run 'bun run generate-providers' to update

export const providerName = ${JSON.stringify(providerName)}
export const providerConfig = ${JSON.stringify(providerData, null, 2)} as const
`
    fs.writeFileSync(filePath, fileContent)

    const identifier = toIdentifier(providerName)
    importStatements.push(
      `import { providerConfig as ${identifier} } from './providers/${providerName}'`,
    )
    if (identifier === providerName) {
      providerEntries.push(`  ${identifier},`)
    } else {
      providerEntries.push(`  ${JSON.stringify(providerName)}: ${identifier},`)
    }
  }

  console.log(`Generated ${Object.keys(providers).length} provider files in ${providersSubdir}`)

  // Write main aggregator providers.generated.ts
  const outPath = path.join(generatedDir, 'providers.generated.ts')
  const outContent = `// This file is auto-generated by scripts/generate-builtin-providers.ts
// Do not edit manually - run 'bun run generate-providers' to update

${importStatements.join('\n')}

export const builtinProviders: Record<string, any> = {
${providerEntries.join('\n')}
} as unknown as Record<string, any>
`
  fs.writeFileSync(outPath, outContent)
  console.log(`Successfully generated aggregator: ${outPath}`)
}

const isEntryScript =
  import.meta.main ||
  (process.argv[1] &&
    process.argv[1].endsWith('generate-builtin-providers.ts') &&
    !process.argv[1].includes('.test.'))

if (isEntryScript) {
  sync().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
