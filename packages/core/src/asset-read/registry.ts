import type { ReaderKind } from '@shumai/operations'
import { documentReader } from './readers/document'
import { imageReader } from './readers/image'
import { model3dReader } from './readers/model3d'
import { videoReader } from './readers/video'
import type { AssetReader, ReadableAsset } from './types'

type MissingKinds<TReaders extends readonly AssetReader[]> = Exclude<
  ReaderKind,
  TReaders[number]['kind']
>

/** Compile-time guard: every reader kind declared in `@shumai/operations` needs a reader. */
function defineReaderRegistry<const TReaders extends readonly AssetReader[]>(
  readers: TReaders &
    ([MissingKinds<TReaders>] extends [never]
      ? unknown
      : { missingReaders: MissingKinds<TReaders> }),
): TReaders {
  return readers
}

/**
 * Readers in matching order: the first reader whose `matches` returns true handles the asset.
 * 3D comes before image (3D models also have image transcodes); documents cover PDFs and text.
 */
export const readers = defineReaderRegistry([
  model3dReader,
  imageReader,
  videoReader,
  documentReader,
] as const)

export function findReader(asset: ReadableAsset): AssetReader | undefined {
  return readers.find((reader) => reader.matches(asset)) as AssetReader | undefined
}

export function getReader(kind: ReaderKind): AssetReader {
  const reader = readers.find((r) => r.kind === kind)
  if (!reader) throw new Error(`No reader registered for "${kind}"`)
  return reader as AssetReader
}
