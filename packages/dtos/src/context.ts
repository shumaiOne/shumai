import type { ShumaiMessageContext } from './chat'

/**
 * Escapes special XML characters in attribute and text values to prevent
 * XML malformation and prompt injection.
 */
export function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAttr(name: string, value: string | undefined): string {
  if (value === undefined || value === null) return ''
  return ` ${name}="${escapeXmlAttr(value)}"`
}

/**
 * Pure, deterministic serializer that converts a ShumaiMessageContext
 * object into a standardized, order-stable <context> XML block.
 *
 * Adheres strictly to the following invariants:
 * 1. Tag sequence: <user>, <thread>, <current_asset>, <position>, <annotation>, <attached_files>, <referenced_assets>
 * 2. Attribute sequence on every tag follows fixed, invariant order.
 * 3. Arrays (attachedFiles, referencedAssets) sorted by id ascending.
 * 4. Floats formatted with .toFixed(2), integers rounded.
 * 5. String values escaped via escapeXmlAttr.
 * 6. Exact 2-space indentation and LF newlines.
 */
export function serializeContextToXml(context?: ShumaiMessageContext | null): string {
  if (!context) return ''

  const lines: string[] = []

  // 1. <user ... />
  if (context.user) {
    let userAttrs = ''
    if (context.user.id !== undefined) userAttrs += formatAttr('id', context.user.id)
    if (context.user.name !== undefined) userAttrs += formatAttr('name', context.user.name)
    if (context.user.role !== undefined) userAttrs += formatAttr('role', context.user.role)
    if (userAttrs) {
      lines.push(`  <user${userAttrs} />`)
    }
  }

  // 2. <thread ... />
  if (context.thread) {
    let threadAttrs = ''
    if (context.thread.id !== undefined) threadAttrs += formatAttr('id', context.thread.id)
    if (context.thread.replyCount !== undefined) {
      threadAttrs += ` reply_count="${Math.round(context.thread.replyCount)}"`
    }
    if (threadAttrs) {
      lines.push(`  <thread${threadAttrs} />`)
    }
  }

  // 3. <current_asset ...> ... </current_asset>
  if (context.currentAsset) {
    const ca = context.currentAsset
    let assetAttrs = ''
    if (ca.id !== undefined) assetAttrs += formatAttr('id', ca.id)
    if (ca.name !== undefined) assetAttrs += formatAttr('name', ca.name)
    if (ca.type !== undefined) assetAttrs += formatAttr('type', ca.type)
    if (ca.mediaType !== undefined) assetAttrs += formatAttr('media_type', ca.mediaType)
    if (ca.mimeType !== undefined) assetAttrs += formatAttr('mime_type', ca.mimeType)
    if (ca.parentId !== undefined) assetAttrs += formatAttr('parent_id', ca.parentId)
    if (ca.path !== undefined) assetAttrs += formatAttr('path', ca.path)
    if (ca.durationSeconds !== undefined) {
      assetAttrs += ` duration_seconds="${ca.durationSeconds.toFixed(2)}"`
    }
    if (ca.totalFrames !== undefined) {
      assetAttrs += ` total_frames="${Math.round(ca.totalFrames)}"`
    }
    if (ca.totalPages !== undefined) {
      assetAttrs += ` total_pages="${Math.round(ca.totalPages)}"`
    }
    if (ca.navigated !== undefined) {
      assetAttrs += ` navigated="${String(ca.navigated)}"`
    }

    if (ca.ancestors && ca.ancestors.length > 0) {
      lines.push(`  <current_asset${assetAttrs}>`)
      lines.push('    <ancestors>')
      for (const anc of ca.ancestors) {
        let ancAttrs = ''
        if (anc.id !== undefined) ancAttrs += formatAttr('id', anc.id)
        if (anc.name !== undefined) ancAttrs += formatAttr('name', anc.name)
        lines.push(`      <folder${ancAttrs} />`)
      }
      lines.push('    </ancestors>')
      lines.push('  </current_asset>')
    } else {
      lines.push(`  <current_asset${assetAttrs} />`)
    }
  }

  // 3. <position ... />
  if (context.position) {
    if (context.position.type === 'time') {
      lines.push(`  <position type="time" seconds="${context.position.seconds.toFixed(2)}" />`)
    } else if (context.position.type === 'page') {
      lines.push(`  <position type="page" page="${Math.round(context.position.page)}" />`)
    }
  }

  // 4. <annotation />
  if (context.annotation) {
    lines.push('  <annotation />')
  }

  // 5. <attached_files> ... </attached_files>
  if (context.attachedFiles && context.attachedFiles.length > 0) {
    const sortedFiles = [...context.attachedFiles].sort((a, b) => a.id.localeCompare(b.id))
    lines.push('  <attached_files>')
    for (const file of sortedFiles) {
      let fileAttrs = ''
      if (file.id !== undefined) fileAttrs += formatAttr('id', file.id)
      if (file.name !== undefined) fileAttrs += formatAttr('name', file.name)
      if (file.type !== undefined) fileAttrs += formatAttr('type', file.type)
      if (file.mediaType !== undefined) fileAttrs += formatAttr('media_type', file.mediaType)
      if (file.mimeType !== undefined) fileAttrs += formatAttr('mime_type', file.mimeType)
      if (file.path !== undefined) fileAttrs += formatAttr('path', file.path)
      lines.push(`    <file${fileAttrs} />`)
    }
    lines.push('  </attached_files>')
  }

  // 6. <referenced_assets> ... </referenced_assets>
  if (context.referencedAssets && context.referencedAssets.length > 0) {
    const sortedAssets = [...context.referencedAssets].sort((a, b) => a.id.localeCompare(b.id))
    lines.push('  <referenced_assets>')
    for (const item of sortedAssets) {
      if (item.type === 'folder') {
        let folderAttrs = ''
        if (item.id !== undefined) folderAttrs += formatAttr('id', item.id)
        if (item.name !== undefined) folderAttrs += formatAttr('name', item.name)
        if (item.path !== undefined) folderAttrs += formatAttr('path', item.path)
        lines.push(`    <folder${folderAttrs} />`)
      } else {
        let assetAttrs = ''
        if (item.id !== undefined) assetAttrs += formatAttr('id', item.id)
        if (item.name !== undefined) assetAttrs += formatAttr('name', item.name)
        if (item.type !== undefined) assetAttrs += formatAttr('type', item.type)
        if (item.mediaType !== undefined) assetAttrs += formatAttr('media_type', item.mediaType)
        if (item.mimeType !== undefined) assetAttrs += formatAttr('mime_type', item.mimeType)
        if (item.path !== undefined) assetAttrs += formatAttr('path', item.path)
        lines.push(`    <asset${assetAttrs} />`)
      }
    }
    lines.push('  </referenced_assets>')
  }

  if (lines.length === 0) return ''

  return `<context>\n${lines.join('\n')}\n</context>`
}
