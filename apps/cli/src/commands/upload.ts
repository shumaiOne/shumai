import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { ulid } from 'ulid'
import { getClient } from '../client'

interface CliFileNode {
  name: string
  id: string
  size: number
  children: CliFileNode[]
  type: 'file' | 'folder'
  mediaType?: string
}

export function getMediaType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

async function buildFileTree(
  localPath: string,
  fileMap: Map<string, { path: string; name: string; size: number; mediaType: string }>,
): Promise<CliFileNode> {
  const stat = await fsPromises.stat(localPath)
  const name = path.basename(localPath)
  const id = ulid()

  if (stat.isDirectory()) {
    const childrenNames = await fsPromises.readdir(localPath)
    const children: CliFileNode[] = []
    for (const childName of childrenNames) {
      if (childName.startsWith('.')) continue
      const childNode = await buildFileTree(path.join(localPath, childName), fileMap)
      children.push(childNode)
    }
    return {
      name,
      id,
      size: 0,
      children,
      type: 'folder',
    }
  } else {
    const mediaType = getMediaType(name)
    fileMap.set(id, { path: localPath, name, size: stat.size, mediaType })
    return {
      name,
      id,
      size: stat.size,
      children: [],
      type: 'file',
      mediaType,
    }
  }
}

export class ProgressTracker {
  private uploads = new Map<string, { name: string; size: number; uploadedBytes: number }>()
  private isTty = process.stdout.isTTY
  private linesPrinted = 0

  addUpload(id: string, name: string, size: number) {
    this.uploads.set(id, { name, size, uploadedBytes: 0 })
    if (this.isTty) {
      console.log(`${name.padEnd(30)} [${'░'.repeat(20)}] 0%`)
      this.linesPrinted++
      console.log('')
      this.linesPrinted++
    }
  }

  updateProgress(id: string, uploadedBytes: number) {
    const item = this.uploads.get(id)
    if (!item) return
    item.uploadedBytes = uploadedBytes

    if (this.isTty) {
      process.stdout.write('\x1B[' + this.linesPrinted + 'A')
      this.linesPrinted = 0
      for (const upload of this.uploads.values()) {
        const pct =
          upload.size > 0
            ? Math.min(Math.round((upload.uploadedBytes / upload.size) * 100), 100)
            : 100
        const barLength = 20
        const filledLength = Math.round((pct / 100) * barLength)
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
        console.log(`${upload.name.padEnd(30)} [${bar}] ${pct}%`)
        this.linesPrinted++
        console.log('')
        this.linesPrinted++
      }
    } else {
      const pct = item.size > 0 ? Math.min(Math.round((uploadedBytes / item.size) * 100), 100) : 100
      if (pct === 100 || uploadedBytes === 0 || pct % 25 === 0) {
        console.log(`Uploading ${item.name}: ${pct}%`)
      }
    }
  }
}

export async function uploadFileWithProgress(
  url: string,
  filePath: string,
  contentType: string,
  onProgress: (bytesUploaded: number) => void,
) {
  const stat = fs.statSync(filePath)
  const totalSize = stat.size

  const parsedUrl = new URL(url)
  const isHttps = parsedUrl.protocol === 'https:'
  const requestModule = isHttps ? https : http

  const options = {
    method: 'PUT',
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    headers: {
      'Content-Type': contentType,
      'Content-Length': totalSize.toString(),
    },
  }

  return new Promise<void>((resolve, reject) => {
    const req = requestModule.request(options, (res) => {
      res.resume()
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve()
      } else {
        reject(new Error(`Failed to upload to S3: ${res.statusCode} ${res.statusMessage}`))
      }
    })

    req.on('error', (err) => {
      reject(err)
    })

    const fileStream = fs.createReadStream(filePath)
    let bytesUploaded = 0

    fileStream.on('data', (chunk) => {
      bytesUploaded += chunk.length
      onProgress(bytesUploaded)
      req.write(chunk)
    })

    fileStream.on('end', () => {
      req.end()
    })

    fileStream.on('error', (err) => {
      req.destroy()
      reject(err)
    })
  })
}

export async function upload(localPath: string, parentId: string) {
  if (!localPath) {
    console.error('Error: Local file/folder path is required.')
    process.exit(1)
  }
  if (!parentId) {
    console.error('Error: Parent ID (-p/--parent) is required.')
    process.exit(1)
  }

  const resolvedPath = path.resolve(localPath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Local path "${resolvedPath}" does not exist.`)
    process.exit(1)
  }

  const client = getClient()

  try {
    const parentRes = await client.api.folders[':folderId'].$get({
      param: { folderId: parentId },
    })
    if (!parentRes.ok) {
      const err = (await parentRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error fetching parent folder details: ${err.error || 'Failed'}`)
      process.exit(1)
    }
    const parentFolder = await parentRes.json()
    const projectId = parentFolder.projectId
    if (!projectId) {
      console.error('Error: Parent folder does not belong to any project.')
      process.exit(1)
    }

    const projectRes = await client.api.projects[':projectId'].$get({
      param: { projectId },
    })
    if (!projectRes.ok) {
      const err = (await projectRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error fetching project details: ${err.error || 'Failed'}`)
      process.exit(1)
    }
    const project = await projectRes.json()
    const teamId = project.teamId

    const fileMap = new Map<
      string,
      { path: string; name: string; size: number; mediaType: string }
    >()
    const rootNode = await buildFileTree(resolvedPath, fileMap)

    console.log(`Starting upload task for ${fileMap.size} files...`)

    const taskRes = await client.api.teams[':teamId'].upload.tasks.$post({
      param: { teamId },
      json: {
        parentId,
        files: [rootNode],
      },
    })

    if (!taskRes.ok) {
      const err = (await taskRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error creating upload task: ${err.error || 'Failed'}`)
      process.exit(1)
    }

    const { taskId, presignedUrls, createdAssets } = await taskRes.json()

    const progress = new ProgressTracker()
    for (const urlObj of presignedUrls) {
      const fileMeta = fileMap.get(urlObj.id)
      if (fileMeta) {
        progress.addUpload(urlObj.id, fileMeta.name, fileMeta.size)
      }
    }

    const concurrencyLimit = 3
    const queue = [...presignedUrls]
    const activeUploads: Promise<void>[] = []

    const uploadNext = async (): Promise<void> => {
      if (queue.length === 0) return
      const urlObj = queue.shift()!
      const fileMeta = fileMap.get(urlObj.id)!

      try {
        await uploadFileWithProgress(urlObj.url, fileMeta.path, fileMeta.mediaType, (bytes) => {
          progress.updateProgress(urlObj.id, bytes)
        })

        const confirmRes = await client.api.teams[':teamId'].upload.tasks[':taskId'].$patch({
          param: { teamId, taskId },
          json: { fileId: urlObj.fileId },
        })

        if (!confirmRes.ok) {
          throw new Error('Failed to confirm upload')
        }
      } catch (err) {
        console.error(
          `\nFailed to upload ${fileMeta.name}:`,
          err instanceof Error ? err.message : err,
        )
        await client.api.teams[':teamId'].upload.tasks[':taskId']
          .$patch({
            param: { teamId, taskId },
            json: {
              fileId: urlObj.fileId,
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          })
          .catch(() => {})
      }

      return uploadNext()
    }

    for (let i = 0; i < Math.min(concurrencyLimit, presignedUrls.length); i++) {
      activeUploads.push(uploadNext())
    }

    await Promise.all(activeUploads)

    console.log('\nUpload completed!')

    if (createdAssets && createdAssets.length > 0) {
      console.log('Uploaded asset IDs:')
      const topLevelTempIds = new Set<string>()
      topLevelTempIds.add(rootNode.id)

      for (const asset of createdAssets) {
        if (topLevelTempIds.has(asset.tempId)) {
          console.log(`- ${asset.assetId}`)
        }
      }
    }
  } catch (err) {
    console.error('\nError connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
