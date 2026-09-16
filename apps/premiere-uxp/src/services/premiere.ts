import type { Project, Sequence, premierepro } from '@adobe/premierepro'

/**
 * Safely resolves the Premiere Pro host module (`premierepro`).
 */
export function getPremiereModule(): premierepro | null {
  try {
    // In UXP, host modules are available via require()
    if (typeof window !== 'undefined' && 'require' in window) {
      // Dynamic runtime property injected on window by Adobe UXP
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).require('premierepro')
    }
    if (typeof require !== 'undefined') {
      // Adobe UXP host modules must be resolved dynamically at runtime via CommonJS require
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('premierepro')
    }
  } catch (err) {
    console.warn('[UXP] premierepro module not available:', err)
  }
  return null
}

/**
 * Safely resolves the UXP environment module (`uxp`).
 */
export function getUxpModule(): UxpModule | null {
  try {
    if (typeof window !== 'undefined' && 'require' in window) {
      // Dynamic runtime property injected on window by Adobe UXP
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).require('uxp')
    }
    if (typeof require !== 'undefined') {
      // Adobe UXP host modules must be resolved dynamically at runtime via CommonJS require
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('uxp')
    }
  } catch (err) {
    console.warn('[UXP] uxp module not available:', err)
  }
  return null
}

/**
 * Retrieves the currently active project in Premiere Pro.
 */
export async function getActiveProject(): Promise<Project | null> {
  const ppro = getPremiereModule()
  if (!ppro?.Project) {
    return null
  }
  try {
    return await ppro.Project.getActiveProject()
  } catch (err) {
    console.error('Failed to get active project:', err)
    return null
  }
}

/**
 * Retrieves the currently active sequence of the project.
 */
export async function getActiveSequence(project?: Project | null): Promise<Sequence | null> {
  const pr = project || (await getActiveProject())
  if (!pr) return null
  try {
    const seq = await pr.getActiveSequence()
    return seq || null
  } catch (err) {
    console.error('Failed to get active sequence:', err)
    return null
  }
}

/**
 * Retrieves all sequences in the project.
 */
export async function getAllSequences(project?: Project | null): Promise<Sequence[]> {
  const pr = project || (await getActiveProject())
  if (!pr) return []
  try {
    const seqs = await pr.getSequences()
    return seqs || []
  } catch (err) {
    console.error('Failed to get all sequences:', err)
    return []
  }
}

/**
 * Opens and activates a sequence in the Premiere Pro timeline.
 */
export async function openSequenceInTimeline(
  sequence: Sequence,
  project?: Project | null,
): Promise<boolean> {
  const pr = project || (await getActiveProject())
  if (!pr) return false
  try {
    const opened = await pr.openSequence(sequence)
    try {
      await pr.setActiveSequence(sequence)
    } catch {
      // setActiveSequence may not be required if openSequence already focuses it
    }
    return opened ?? true
  } catch (err) {
    console.error('Failed to open sequence in timeline:', err)
    return false
  }
}

/**
 * Imports one or more files into the Premiere Pro project root.
 */
export async function importFilesIntoProject(
  project: Project,
  filePaths: string[],
): Promise<boolean> {
  if (!filePaths.length) return false
  try {
    return await project.importFiles(
      filePaths,
      true, // suppressUI
      // @ts-expect-error Premiere Pro UXP requires null instead of undefined to default to project root
      null, // targetBin; `null` defaults to project root
      false, // asNumberedStills
    )
  } catch (err) {
    console.error('Failed to import files into Premiere project:', err)
    return false
  }
}

/**
 * Opens the native OS folder picker to ask the user where to save files.
 * Returns the selected UxpFolderEntry, or null if the user cancelled.
 */
export async function promptSelectFolder(): Promise<UxpFolderEntry | null> {
  const uxp = getUxpModule()
  if (!uxp?.storage?.localFileSystem) {
    throw new Error('UXP storage.localFileSystem is not available.')
  }
  try {
    return await uxp.storage.localFileSystem.getFolder()
  } catch (err) {
    console.error('Error in promptSelectFolder:', err)
    return null
  }
}

/**
 * Opens the native OS file picker to ask the user where to save a file.
 * Returns the selected UxpFileEntry, or null if the user cancelled.
 */
export async function promptSaveFile(defaultName: string): Promise<UxpFileEntry | null> {
  const uxp = getUxpModule()
  if (!uxp?.storage?.localFileSystem) {
    throw new Error('UXP storage.localFileSystem is not available.')
  }
  try {
    return await uxp.storage.localFileSystem.getFileForSaving(defaultName)
  } catch (err) {
    console.error('Error in promptSaveFile:', err)
    return null
  }
}

/**
 * Writes an ArrayBuffer into a UXP File entry as binary.
 */
export async function writeBinaryFile(file: UxpFileEntry, data: ArrayBuffer): Promise<void> {
  const uxp = getUxpModule()
  const format = uxp?.storage?.formats?.binary
  await file.write(data, { format })
}
