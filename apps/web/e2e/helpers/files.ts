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
