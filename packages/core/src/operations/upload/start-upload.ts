import type { StartedUploadOutput } from '@shumai/operations'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import {
  pendingUploadService,
  type PendingUploadKind,
} from '@shumai/core/src/upload/pending-upload'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import type { OperationContext } from '../context'
import { badRequest } from '../errors'

interface StartUploadInput {
  parent: string
  name: string
  contentType?: string
  metadata?: Record<string, unknown>
}

/**
 * Checks that `metadata` only sets the project's Creation Context fields, so a bad key fails
 * before anything is uploaded rather than when the upload is completed.
 */
export async function assertCreationMetadata(
  userId: string,
  projectId: string | undefined,
  metadata: Record<string, unknown> | undefined,
): Promise<void> {
  const keys = Object.keys(metadata ?? {})
  if (keys.length === 0) return
  if (!projectId) throw badRequest('metadata is only supported for files in a project')

  const fields = await metadataService.listProjectFields(userId, projectId)
  const allowed = fields
    .filter((f) => f.field.config?.autofillSource === 'CREATION_CONTEXT')
    .map((f) => f.field.key)
  const invalid = keys.filter((key) => !allowed.includes(key))
  if (invalid.length > 0) {
    throw badRequest(
      `metadata only accepts the project's Creation Context fields; not allowed: ${invalid.join(', ')}. ` +
        (allowed.length > 0
          ? `Allowed: ${allowed.join(', ')} (see list_metadata_fields).`
          : 'This project has none, so omit metadata.'),
    )
  }
}

/** Starts an upload and returns where to send the bytes and how to finish it. */
export async function startUpload(
  kind: PendingUploadKind,
  input: StartUploadInput,
  ctx: OperationContext,
): Promise<StartedUploadOutput> {
  const name = sanitizeFilename(input.name)
  const started = await pendingUploadService.start({
    kind,
    userId: ctx.userId,
    parentId: input.parent,
    name,
    contentType: input.contentType ?? getFileMimeType(null, name),
    metadata: input.metadata,
  })
  return {
    uploadId: started.uploadId,
    uploadUrl: started.uploadUrl,
    method: 'PUT',
    expiresAt: started.expiresAt.toISOString(),
    // Shumai's built-in agent writes the file straight to storage from its sandbox.
    ...(ctx.via === 'agent' ? { key: started.key } : {}),
  }
}
