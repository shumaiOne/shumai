# Built-in Image & Video Generation Implementation Plan

## 1. Overview & Objectives

Provide built-in image and video generation tools (`generate_image` and `generate_video`) to Shumai agents so users do not need to install manual skills.

Key design principles:
- **Zero Schema Migrations**: Provider overrides and enabled models are stored within the existing `Team.settings` JSON column.
- **Dynamic Harness Injection**: The tools `generate_image` and `generate_video` are enabled by default, but the backend harness only injects them if valid configured models and working API keys (either custom-entered or resolved via default environment variables) exist for that team.
- **Two-Part Settings UI**:
  1. *Built-in Provider List*: Fixed list of all 13 supported AI SDK providers with ability to configure/override the API Key (literal key or env variable name).
  2. *Enabled Model List*: Configured models list (default empty), allowing users to add models by selecting Type (`Image` / `Video`), Provider, and Model (with custom model ID support).
- **Safe Sandboxed Execution**: Generated media files are written directly into `.pi/` directory, returning file paths and metadata to the agent. Agents can process them with bash/ffmpeg or upload them to project assets via `create_file`.

---

## 2. All 13 Built-in Providers & Supported Models

The providers and models are based directly on official `@ai-sdk/*` package definitions:

| Provider | AI SDK Package | Default Env Key | Capabilities | Models (Curated & Extensible) |
|---|---|---|---|---|
| **OpenAI** | `@ai-sdk/openai` | `OPENAI_API_KEY` | Image | `dall-e-3`, `gpt-image-2`, `dall-e-2`, `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, `chatgpt-image-latest` |
| **Google** | `@ai-sdk/google` | `GEMINI_API_KEY` | Image, Video | **Image**: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`<br>**Video**: `veo-3.1-generate`, `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview`, `veo-3.0-generate-001`, `veo-3.0-fast-generate-001`, `veo-2.0-generate-001` |
| **Google Vertex** | `@ai-sdk/google-vertex` | `GOOGLE_CLOUD_API_KEY` | Image, Video | **Image**: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`<br>**Video**: `veo-3.1-generate-001`, `veo-3.1-fast-generate-001`, `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.0-generate-001`, `veo-3.0-fast-generate-001`, `veo-3.0-generate-preview`, `veo-3.0-fast-generate-preview`, `veo-2.0-generate-001`, `veo-2.0-generate-preview`, `veo-2.0-generate-exp` |
| **xAI** | `@ai-sdk/xai` | `XAI_API_KEY` | Image, Video | **Image**: `grok-imagine-image`, `grok-imagine-image-pro`<br>**Video**: `grok-imagine-video`, `grok-imagine-video-1.5` |
| **Fal** | `@ai-sdk/fal` | `FAL_KEY` | Image, Video | **Image**: `fal-ai/flux/dev`, `fal-ai/flux/schnell`, `fal-ai/flux-lora`, `fal-ai/flux-pro/v1.1`, `fal-ai/flux-pro/v1.1-ultra`, `fal-ai/flux-pro/v1.1-ultra-finetuned`, `fal-ai/flux-pro/kontext`, `fal-ai/flux-pro/kontext/max`, `fal-ai/flux-general`, `fal-ai/ideogram/character`, `fal-ai/imagen4/preview`, `fal-ai/luma-photon`, `fal-ai/luma-photon/flash`, `fal-ai/recraft/v3/text-to-image`, `fal-ai/sana/v1.5/4.8b`, `fal-ai/wan/v2.2-5b/text-to-image`, `fal-ai/wan/v2.2-a14b/text-to-image`, `bria/text-to-image/3.2`, `fal-ai/bytedance/dreamina/v3.1/text-to-image`, `fal-ai/clarity-upscaler`, `fal-ai/creative-upscaler`, `fal-ai/aura-sr`<br>**Video**: `luma-ray-2`, `luma-ray-2-flash`, `luma-dream-machine`, `minimax-video`, `minimax-video-01`, `hunyuan-video` |
| **Replicate** | `@ai-sdk/replicate` | `REPLICATE_API_TOKEN` | Image, Video | **Image**: `black-forest-labs/flux-1.1-pro`, `black-forest-labs/flux-1.1-pro-ultra`, `black-forest-labs/flux-dev`, `black-forest-labs/flux-pro`, `black-forest-labs/flux-schnell`, `black-forest-labs/flux-2-pro`, `black-forest-labs/flux-2-dev`, `black-forest-labs/flux-fill-pro`, `black-forest-labs/flux-fill-dev`, `ideogram-ai/ideogram-v2`, `ideogram-ai/ideogram-v2-turbo`, `recraft-ai/recraft-v3`, `recraft-ai/recraft-v3-svg`, `stability-ai/stable-diffusion-3.5-large`, `stability-ai/stable-diffusion-3.5-large-turbo`, `stability-ai/stable-diffusion-3.5-medium`, `luma/photon`, `luma/photon-flash`, `bytedance/sdxl-lightning-4step`, `lucataco/dreamshaper-xl-turbo`, `lucataco/open-dalle-v1.1`, `lucataco/realvisxl-v2.0`, `nvidia/sana`, `playgroundai/playground-v2.5-1024px-aesthetic`<br>**Video**: `minimax/video-01`, `stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438` |
| **Black Forest Labs** | `@ai-sdk/black-forest-labs` | `BFL_API_KEY` | Image, Video | **Image**: `flux-kontext-pro`, `flux-kontext-max`, `flux-pro-1.1-ultra`, `flux-pro-1.1`, `flux-pro-1.0-fill`<br>**Video**: `flux-3-video` |
| **Kling AI** | `@ai-sdk/klingai` | `KLINGAI_API_KEY` | Video | **Video**: `kling-v3.0-t2v`, `kling-v3.0-i2v`, `kling-v3.0-motion-control`, `kling-v2.6-t2v`, `kling-v2.6-i2v`, `kling-v2.6-motion-control`, `kling-v2.5-turbo-t2v`, `kling-v2.5-turbo-i2v`, `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2-master-t2v`, `kling-v1.6-t2v`, `kling-v1.6-i2v`, `kling-v1.5-i2v`, `kling-v1-t2v`, `kling-v1-i2v` |
| **Together.ai** | `@ai-sdk/togetherai` | `TOGETHER_API_KEY` | Image | `black-forest-labs/FLUX.1-schnell`, `black-forest-labs/FLUX.1-schnell-Free`, `black-forest-labs/FLUX.1-dev`, `black-forest-labs/FLUX.1-dev-lora`, `black-forest-labs/FLUX.1.1-pro`, `black-forest-labs/FLUX.1-pro`, `black-forest-labs/FLUX.1-kontext-pro`, `black-forest-labs/FLUX.1-kontext-max`, `black-forest-labs/FLUX.1-kontext-dev`, `black-forest-labs/FLUX.1-canny`, `black-forest-labs/FLUX.1-depth`, `black-forest-labs/FLUX.1-redux`, `stabilityai/stable-diffusion-xl-base-1.0` |
| **Fireworks** | `@ai-sdk/fireworks` | `FIREWORKS_API_KEY` | Image | `accounts/fireworks/models/flux-1-dev-fp8`, `accounts/fireworks/models/flux-1-schnell-fp8`, `accounts/fireworks/models/flux-kontext-pro`, `accounts/fireworks/models/flux-kontext-max`, `accounts/fireworks/models/playground-v2-5-1024px-aesthetic`, `accounts/fireworks/models/japanese-stable-diffusion-xl`, `accounts/fireworks/models/SSD-1B`, `accounts/fireworks/models/stable-diffusion-xl-1024-v1-0` |
| **DeepInfra** | `@ai-sdk/deepinfra` | `DEEPINFRA_API_KEY` | Image | `black-forest-labs/FLUX-1.1-pro`, `black-forest-labs/FLUX-1-schnell`, `black-forest-labs/FLUX-1-dev`, `black-forest-labs/FLUX-pro`, `black-forest-labs/FLUX.1-Kontext-dev`, `black-forest-labs/FLUX.1-Kontext-pro`, `stabilityai/sd3.5`, `stabilityai/sd3.5-medium`, `stabilityai/sdxl-turbo` |
| **Luma** | `@ai-sdk/luma` | `LUMA_API_KEY` | Image | `photon-1`, `photon-flash-1` |
| **Amazon Bedrock**| `@ai-sdk/amazon-bedrock` | `AWS_ACCESS_KEY_ID` | Image | `amazon.nova-canvas-v1:0` |

---

## 3. Data Schema & DTO Layer

### 3.1 DTOs (`packages/dtos/src/media-generation.ts`)
```ts
export type MediaModelType = 'image' | 'video'

export const mediaModelTypeSchema = z.enum(['image', 'video'])

export const updateMediaProviderApiKeySchema = z.object({
  apiKey: z.string().optional(), // literal key or env var name
})

export const createEnabledMediaModelSchema = z.object({
  type: mediaModelTypeSchema,
  provider: z.string().min(1),
  modelId: z.string().min(1),
  name: z.string().optional(),
})

export const enabledMediaModelSchema = createEnabledMediaModelSchema.extend({
  id: z.string(),
  createdAt: z.string(),
})

export const mediaProviderStatusSchema = z.object({
  provider: z.string(),
  defaultEnvKey: z.string(),
  apiKeyConfigured: z.boolean(),
  customApiKeyOrEnv: z.string().optional(),
  supportedTypes: z.array(mediaModelTypeSchema),
})

export const mediaGenerationSettingsResponseSchema = z.object({
  providers: z.array(mediaProviderStatusSchema),
  enabledModels: z.array(enabledMediaModelSchema),
})
```

### 3.2 Prisma JSON Typings (`packages/db/src/prisma-json-types.ts`)
Extend `Settings` interface on `Team`:
```ts
export interface MediaProviderConfig {
  apiKey?: string
}

export interface EnabledMediaModelConfig {
  id: string
  type: 'image' | 'video'
  provider: string
  modelId: string
  name?: string
  createdAt: string
}

export interface MediaGenerationSettings {
  providers?: Record<string, MediaProviderConfig>
  enabledModels?: EnabledMediaModelConfig[]
}

export interface Settings {
  transcode: TranscodeSettings
  mediaGeneration?: MediaGenerationSettings
}
```

---

## 4. Core Service Layer (`packages/core`)

### 4.1 `MediaGenerationService` (`packages/core/src/media-generation/media-generation.ts`)
- **Metadata Registry**: Static dictionary holding all 13 providers, their default env keys, supported types (`image` | `video`), and model catalogs.
- **Methods**:
  - `getSettings(teamId: string)`: Reads `team.settings.mediaGeneration`, returns provider statuses (inspecting both custom settings and `process.env`) and enabled models list.
  - `updateProviderApiKey(teamId: string, provider: string, apiKey?: string)`: Saves or removes custom key in `team.settings.mediaGeneration.providers[provider]`.
  - `addEnabledModel(teamId: string, model: CreateEnabledMediaModelRequest)`: Validates model and adds it with a generated ULID to `team.settings.mediaGeneration.enabledModels`.
  - `removeEnabledModel(teamId: string, modelId: string)`: Removes the model by ID.
  - `getValidModels(teamId: string)`: Returns lists of `{ imageModels: EnabledMediaModelConfig[], videoModels: EnabledMediaModelConfig[] }` that currently have a valid API key (either stored or found in `process.env`).
  - `resolveApiKey(provider: string, customApiKey?: string)`: Resolves actual API key from literal string, environment variable override, or default environment variable.
  - `generateImage(params: GenerateImageParams)`: Creates provider instance via `@ai-sdk/*`, invokes `ai.generateImage`, and returns binary buffer and metadata.
  - `generateVideo(params: GenerateVideoParams)`: Creates provider instance, invokes `ai.experimental_generateVideo`, and returns binary buffer and metadata.

---

## 5. API Layer (`packages/api`)

### 5.1 Route Definition (`packages/api/src/media-generation.ts`)
Route chaining on Hono app:
- `GET /teams/:teamId/media-generation`: returns `{ providers, enabledModels }`.
- `PUT /teams/:teamId/media-generation/providers/:provider`: updates API key for provider.
- `POST /teams/:teamId/media-generation/models`: adds an enabled model.
- `DELETE /teams/:teamId/media-generation/models/:modelId`: deletes an enabled model.

Registered in `packages/api/src/index.ts`.

---

## 6. Agent Tools & Harness Integration (`packages/agent`)

### 6.1 `generate_image` Tool (`packages/agent/src/tools/generate-image.ts`)
- **Parameters**:
  - `prompt`: `Type.String({ description: 'The text prompt describing the image to generate.' })`
  - `model`: Dynamic Enum `Type.Union([...enabledImageModels.map(m => Type.Literal(m.modelId))])` (populated at session creation time with all currently enabled image models).
  - `outputFileName`: `Type.Union([Type.String({ description: 'Optional desired filename for the generated image (e.g. "cover.png"). Set to null for auto-generated name.' }), Type.Null()])`
  - `images`: `Type.Union([Type.Array(Type.String(), { description: 'Optional list of reference image paths (e.g. in .pi/), workspace asset IDs, or URLs for image-to-image or style reference. Set to null if not using.' }), Type.Null()])`
  - `mask`: `Type.Union([Type.String({ description: 'Optional path or URL to an inpainting mask image (white=inpaint, black=keep). Set to null if not inpainting.' }), Type.Null()])`
  - `aspectRatio`: `Type.Union([Type.String({ description: 'Aspect ratio, e.g. "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2". Set to null for default.' }), Type.Null()])`
  - `size`: `Type.Union([Type.String({ description: 'Target image dimensions, e.g. "1024x1024", "1536x1024". Set to null for default.' }), Type.Null()])`
  - `seed`: `Type.Union([Type.Integer({ description: 'Random seed for reproducible generations. Set to null for random.' }), Type.Null()])`
- **Execution**:
  - Resolves selected model and its API key.
  - If `images` (or `mask`) are provided, resolves local files / downloads them, and formats `prompt` as `{ text: prompt, images: [...], mask }` using AI SDK's native `GenerateImagePrompt` format.
  - Generates image via `mediaGenerationService.generateImage`.
  - Writes image bytes to `.pi/<outputFileName || 'generated_image_' + ulid + '.' + ext>`.
  - Returns result text with relative path (`.pi/...`), absolute path, size, and dimensions.

### 6.2 `generate_video` Tool (`packages/agent/src/tools/generate-video.ts`)
Supports 4 explicit video generation modes via a dedicated `mode` enum and separate configuration objects:

- **Mode Enum**:
  - `'text_to_video'`: Standard text prompt generation.
  - `'image_to_video'`: Animate an input image.
  - `'first_last_frame'`: Transition/interpolate between a first and last frame.
  - `'reference_to_video'`: Condition generation on reference media inputs (character/style/motion).

- **Parameters**:
  - `mode`: `Type.Union([Type.Literal('text_to_video'), Type.Literal('image_to_video'), Type.Literal('first_last_frame'), Type.Literal('reference_to_video')])`
  - `model`: Dynamic Enum `Type.Union([...enabledVideoModels.map(m => Type.Literal(m.modelId))])` (populated at session creation time with all currently enabled video models).
  - `outputFileName`: `Type.Union([Type.String({ description: 'Optional desired filename for the generated video (e.g. "intro.mp4"). Set to null for auto-generated name.' }), Type.Null()])`
  - `textToVideoConfig`: `Type.Union([Type.Object({ prompt: Type.String({ description: 'Text prompt describing the desired video scene and motion.' }) }, { additionalProperties: false }), Type.Null()])`
  - `imageToVideoConfig`: `Type.Union([Type.Object({ image: Type.String({ description: 'Path (e.g. in .pi/), asset ID, or URL of the image to animate.' }), prompt: Type.Union([Type.String({ description: 'Optional motion description.' }), Type.Null()]) }, { additionalProperties: false }), Type.Null()])`
  - `firstLastFrameConfig`: `Type.Union([Type.Object({ firstFrame: Type.Union([Type.String({ description: 'Starting frame image path or URL.' }), Type.Null()]), lastFrame: Type.Union([Type.String({ description: 'Ending frame image path or URL.' }), Type.Null()]), prompt: Type.Union([Type.String({ description: 'Optional prompt describing the transition.' }), Type.Null()]) }, { additionalProperties: false }), Type.Null()])`
  - `referenceToVideoConfig`: `Type.Union([Type.Object({ references: Type.Array(Type.String(), { description: 'List of image/video paths, asset IDs, or URLs for reference.' }), prompt: Type.Union([Type.String({ description: 'Prompt describing the video to generate.' }), Type.Null()]) }, { additionalProperties: false }), Type.Null()])`
  - `aspectRatio`: `Type.Union([Type.String({ description: 'Aspect ratio, e.g. "16:9", "9:16", "1:1", or "adaptive", or null for default.' }), Type.Null()])`
  - `resolution`: `Type.Union([Type.String({ description: 'Target video resolution, e.g. "1280x720", or null for default.' }), Type.Null()])`
  - `duration`: `Type.Union([Type.Integer({ description: 'Duration in seconds, or null for default.' }), Type.Null()])`
  - `fps`: `Type.Union([Type.Integer({ description: 'Frames per second, or null for default.' }), Type.Null()])`
  - `generateAudio`: `Type.Union([Type.Boolean({ description: 'Whether to generate audio alongside video, or null for default.' }), Type.Null()])`
  - `seed`: `Type.Union([Type.Integer({ description: 'Random seed for reproducible video generation, or null for random.' }), Type.Null()])`

- **Execution**:
  - Resolves selected model and its API key.
  - Inspects `mode` and extracts the appropriate config:
    - If `mode === 'text_to_video'`: passes `prompt: textToVideoConfig.prompt` to AI SDK.
    - If `mode === 'image_to_video'`: resolves `imageToVideoConfig.image` to `DataContent` and passes `prompt: { text: imageToVideoConfig.prompt, image: resolvedImage }`.
    - If `mode === 'first_last_frame'`: resolves `firstFrame` / `lastFrame` and passes `frameImages: [{ image, frameType: 'first_frame' }, { image, frameType: 'last_frame' }]` and `prompt: firstLastFrameConfig.prompt`.
    - If `mode === 'reference_to_video'`: resolves `references` and passes `inputReferences: [...]` and `prompt: referenceToVideoConfig.prompt`.
  - Invokes `mediaGenerationService.generateVideo`.
  - Writes video bytes to `.pi/<outputFileName || 'generated_video_' + ulid + '.mp4'>`.
  - Returns result text with relative path (`.pi/...`), absolute path, size, and metadata.

### 6.3 Dynamic Tool Injection (`packages/agent/src/index.ts`)
In `createAgentSession`:
1. Query `mediaGenerationService.getValidModels(teamId)`.
2. If `imageModels.length > 0` and not in `deniedTools`: inject `generate_image` instantiated with the dynamic enum of currently enabled image models.
3. If `videoModels.length > 0` and not in `deniedTools`: inject `generate_video` instantiated with the dynamic enum of currently enabled video models.
4. If neither has valid configured models with active keys: neither tool is injected.

---

## 7. WebUI Settings Page (`packages/webui`)

### 7.1 New Settings Component (`packages/webui/components/settings/ImageVideoGenerationSettings.tsx`)
1. **Providers Section**:
   - Displays cards for all 13 built-in providers.
   - Shows badge for supported capabilities (`Image`, `Video`).
   - Status badge distinguishing:
     - `Configured (Environment)`: detected from process environment variable (e.g. `OPENAI_API_KEY`).
     - `Configured (Custom)`: overridden by team owner with custom key or custom env var name.
     - `Not Configured`: key missing.
   - Default environment variable name shown as helper text (e.g. `Default: OPENAI_API_KEY`).
   - "Configure API Key" dialog: input for literal API key or custom env var name, with default env key hint and clear button.
2. **Enabled Models Section**:
   - Header with "Add Model" button.
   - List of enabled models with Type badge (`Image` / `Video`), Provider, Model ID, custom name, and Delete button.
   - "Add Model" Dialog:
     - Dropdown 1: Type (`Image` | `Video`).
     - Dropdown 2: Provider (filtered to providers that support the chosen Type).
     - Dropdown 3: Model — Combobox/Select with known curated models for that provider & type, plus a field/toggle to enter a custom model ID.
     - Text input: Display Name (optional).

### 7.2 Sidebar Navigation Integration
In `packages/webui/routes/teams/$teamId/settings.lazy.tsx`:
- Add tab `'image-video'` under AI settings section (owner-only).
- Label: `m.image_video_generation()`.
- Route hash: `#image-video`.

### 7.3 Internationalization (i18n)
Add corresponding translation keys in:
- `packages/webui/messages/en.json`
- `packages/webui/messages/zh.json`
Run `bun run i18n:compile` to generate type-safe message getters.

---

## 8. Verification & Testing Plan

1. **Unit & Service Tests**:
   - `packages/core/src/media-generation/media-generation.test.ts`: test API key resolution, settings persistence, model addition/deletion, and filtering.
   - `packages/api/src/media-generation.test.ts`: test Hono API endpoints with mock service methods.
2. **Agent Tool & Injection Tests**:
   - `packages/agent/src/tools/generate-image.test.ts`: test tool execution with mocked AI SDK `generateImage` writing file to `.pi/`.
   - `packages/agent/src/tools/generate-video.test.ts`: test tool execution with mocked AI SDK `experimental_generateVideo`.
   - `packages/agent/src/index.test.ts`: test conditional injection of `generate_image` and `generate_video` into `AgentHarness`.
3. **WebUI Component Tests**:
   - `packages/webui/components/settings/ImageVideoGenerationSettings.test.tsx`: test provider key editing dialog and model addition dialog.
4. **Mandatory Full Verification**:
   - `bun run lint`
   - `bun run format`
   - `bun run typecheck`
   - `bun run test`
