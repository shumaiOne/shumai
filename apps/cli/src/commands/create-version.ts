import fs from 'node:fs'
import path from 'node:path'
import { ulid } from 'ulid'
import { getClient } from '../client'
import { getMediaType, ProgressTracker, uploadFileWithProgress } from './upload'

export async function createVersion(localPath: string, parentId: string) {
  if (!localPath) {
    console.error('Error: Local file path is required.')
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

  const stat = fs.statSync(resolvedPath)
  if (stat.isDirectory()) {
    console.error(
      `Error: Local path "${resolvedPath}" is a directory. create-version only supports uploading single files.`,
    )
    process.exit(1)
  }

  const client = getClient()

  try {
    console.log(`Checking parent asset ${parentId}...`)
    const assetRes = await client.api.folders[':folderId'].$get({
      param: { folderId: parentId },
    })

    if (!assetRes.ok) {
      const err = (await assetRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error fetching parent asset details: ${err.error || 'Failed'}`)
      process.exit(1)
    }

    const parentAsset = await assetRes.json()
    if (parentAsset.type !== 'file' && parentAsset.type !== 'version_stack') {
      console.error(
        `Error: Parent asset must be a file or a version_stack (got "${parentAsset.type}").`,
      )
      process.exit(1)
    }

    const projectId = parentAsset.projectId
    if (!projectId) {
      console.error('Error: Parent asset does not belong to any project.')
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

    const name = path.basename(resolvedPath)
    const mediaType = getMediaType(name)

    const fileNode = {
      name,
      id: ulid(),
      size: stat.size,
      children: [],
      type: 'file',
      mediaType,
    }

    console.log(`Creating new version task...`)

    const taskRes = await client.api.teams[':teamId'].upload.tasks.$post({
      param: { teamId },
      json: {
        parentId,
        files: [fileNode],
      },
    })

    if (!taskRes.ok) {
      const err = (await taskRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error creating version task: ${err.error || 'Failed'}`)
      process.exit(1)
    }

    const { taskId, presignedUrls, createdAssets } = await taskRes.json()
    if (!presignedUrls || presignedUrls.length === 0) {
      console.error('Error: Server did not return presigned upload URLs.')
      process.exit(1)
    }

    const urlObj = presignedUrls[0]
    const progress = new ProgressTracker()
    progress.addUpload(urlObj.id, name, stat.size)

    try {
      await uploadFileWithProgress(urlObj.url, resolvedPath, mediaType, (bytes) => {
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
      console.error(`\nFailed to upload ${name}:`, err instanceof Error ? err.message : err)
      await client.api.teams[':teamId'].upload.tasks[':taskId']
        .$patch({
          param: { teamId, taskId },
          json: {
            fileId: urlObj.fileId,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {})
      process.exit(1)
    }

    console.log('\nVersion upload completed!')

    if (createdAssets && createdAssets.length > 0) {
      console.log('Created version asset ID:')
      for (const asset of createdAssets) {
        if (asset.tempId === fileNode.id) {
          console.log(`- ${asset.assetId}`)
        }
      }
    }
  } catch (err) {
    console.error('\nError connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
