import type { APIRequestContext } from '@playwright/test'

export function uniqueProjectName(): string {
  return `Project ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

interface CreateProjectResponse {
  id?: string
  name?: string
}

/** Creates a project through the API for the authenticated request context. */
export async function apiCreateProject(
  request: APIRequestContext,
  teamId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await request.post(`/api/teams/${teamId}/projects`, {
    data: { name },
  })
  if (!res.ok()) {
    throw new Error(`Create project API failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as CreateProjectResponse
  if (!body.id || !body.name) {
    throw new Error(`Create project returned an unexpected response: ${JSON.stringify(body)}`)
  }
  return { id: body.id, name: body.name }
}
