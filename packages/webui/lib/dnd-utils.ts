export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice()
  newArray.splice(to, 0, newArray.splice(from, 1)[0])
  return newArray
}

/**
 * Reorders a subset of fields (a grouped/filtered view) within the full list.
 * `subset` must appear in `full` in the same relative order (filtering preserves order).
 */
export function reorderFieldSubset<T extends { id?: string | null }>(
  full: T[],
  subset: T[],
  from: number,
  to: number,
): T[] {
  if (from === to) return full
  const reordered = arrayMove(subset, from, to)
  const subsetIds = new Set(subset.map((f) => f.id))
  let i = 0
  return full.map((f) => (subsetIds.has(f.id) ? reordered[i++] : f))
}

interface SafeFileSystemEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
}

interface SafeFileSystemFileEntry extends SafeFileSystemEntry {
  file(successCallback: (file: File) => void, errorCallback?: (err: unknown) => void): void
}

interface SafeFileSystemDirectoryEntry extends SafeFileSystemEntry {
  createReader(): SafeFileSystemDirectoryReader
}

interface SafeFileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: SafeFileSystemEntry[]) => void,
    errorCallback?: (err: unknown) => void,
  ): void
}

/**
 * Recursively retrieves all files from a DataTransfer object, traversing directories.
 * Preserves the directory structure using the non-standard `webkitRelativePath` property on File objects.
 */
export async function getAllFilesFromEntries(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []

  interface QueueItem {
    entry: SafeFileSystemEntry
    path: string
  }

  const queue: QueueItem[] = []
  const items = dataTransfer.items

  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = (item as any).webkitGetAsEntry?.() as SafeFileSystemEntry | null
        if (entry) {
          queue.push({ entry, path: '' })
        }
      }
    }
  } else {
    // Fallback if dataTransfer.items is not supported (only dataTransfer.files is available)
    return Array.from(dataTransfer.files)
  }

  const readEntries = (
    dirReader: SafeFileSystemDirectoryReader,
  ): Promise<SafeFileSystemEntry[]> => {
    return new Promise((resolve) => {
      dirReader.readEntries(
        (entries) => resolve(entries),
        () => resolve([]),
      )
    })
  }

  const getFile = (fileEntry: SafeFileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
      fileEntry.file(
        (file) => resolve(file),
        (err) => reject(err),
      )
    })
  }

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) continue
    const { entry, path } = next

    if (entry.isFile) {
      try {
        const file = await getFile(entry as SafeFileSystemFileEntry)
        const relativePath = path ? `${path}/${file.name}` : file.name

        // Define webkitRelativePath dynamically so processAndUploadFiles can read the structure
        Object.defineProperty(file, 'webkitRelativePath', {
          value: relativePath,
          writable: false,
          configurable: true,
        })
        files.push(file)
      } catch (e) {
        console.error('Error reading file entry:', e)
      }
    } else if (entry.isDirectory) {
      const dirReader = (entry as SafeFileSystemDirectoryEntry).createReader()
      let entries: SafeFileSystemEntry[] = []
      let readBatch = await readEntries(dirReader)
      while (readBatch.length > 0) {
        entries = entries.concat(readBatch)
        readBatch = await readEntries(dirReader)
      }

      const newPath = path ? `${path}/${entry.name}` : entry.name
      for (const childEntry of entries) {
        queue.push({ entry: childEntry, path: newPath })
      }
    }
  }

  return files
}
