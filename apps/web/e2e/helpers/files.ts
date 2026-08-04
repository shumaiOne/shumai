import type { APIRequestContext, Locator, Page } from '@playwright/test'

interface CreateShareResponse {
  id?: string
  name?: string
}

/**
 * Locates a file/folder card by its name. File names are rendered as
 * `EditableText` inputs (not text nodes), so `getByText` does not match them.
 * The returned locator points at the card wrapper div (right-clickable to open
 * the card context menu).
 */
export function fileCard(page: Page, name: string): Locator {
  return page
    .locator('div.group')
    .filter({ has: page.locator(`input[value="${name}"]`) })
    .first()
}

/** Creates a share link through the API for the authenticated request context. */
export async function apiCreateShare(
  request: APIRequestContext,
  projectId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await request.post(`/api/projects/${projectId}/shares`, {
    data: { name },
  })
  if (!res.ok()) {
    throw new Error(`Create share API failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as CreateShareResponse
  if (!body.id || !body.name) {
    throw new Error(`Create share returned an unexpected response: ${JSON.stringify(body)}`)
  }
  return { id: body.id, name: body.name }
}

/** Adds assets to a share link through the API. */
export async function apiAddAssetsToShare(
  request: APIRequestContext,
  shareId: string,
  assetIds: string[],
): Promise<void> {
  const res = await request.post(`/api/shares/${shareId}/assets`, {
    data: { assetIds },
  })
  if (!res.ok()) {
    throw new Error(`Add assets to share API failed (${res.status()}): ${await res.text()}`)
  }
}

/** Uploads a file asset through the official API upload task endpoints. */
export async function apiUploadFile(
  request: APIRequestContext,
  teamId: string,
  parentId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ fileId: string; fileName: string }> {
  const tempId = `temp-${Date.now()}`
  const createRes = await request.post(`/api/teams/${teamId}/upload/tasks`, {
    data: {
      parentId,
      files: [
        {
          id: tempId,
          name: fileName,
          type: 'file',
          size: buffer.length,
          mediaType: mimeType,
          children: [],
        },
      ],
    },
  })
  if (!createRes.ok()) {
    throw new Error(`Create upload task failed (${createRes.status()}): ${await createRes.text()}`)
  }
  const taskData = (await createRes.json()) as {
    taskId: string
    presignedUrls: Array<{ id: string; fileId: string; url: string }>
    createdAssets?: Array<{ tempId: string; assetId: string }>
  }
  const presigned = taskData.presignedUrls.find((p) => p.id === tempId)
  const createdAssetId =
    taskData.createdAssets?.find((c) => c.tempId === tempId)?.assetId || presigned?.fileId
  if (!presigned || !createdAssetId) {
    throw new Error('Create upload task did not return presigned URL or asset ID')
  }

  // Upload file buffer to presigned URL
  const uploadRes = await request.put(presigned.url, {
    headers: {
      'Content-Type': mimeType,
    },
    data: buffer,
  })
  if (!uploadRes.ok()) {
    throw new Error(
      `Upload to S3 presigned URL failed (${uploadRes.status()}): ${await uploadRes.text()}`,
    )
  }

  // Confirm upload task
  const confirmRes = await request.patch(`/api/teams/${teamId}/upload/tasks/${taskData.taskId}`, {
    data: {
      fileId: createdAssetId,
      status: 'success',
    },
  })
  if (!confirmRes.ok()) {
    throw new Error(
      `Confirm upload task failed (${confirmRes.status()}): ${await confirmRes.text()}`,
    )
  }

  return { fileId: createdAssetId, fileName }
}
