import type { ExportAssetMetadata, ExportCommentItem, ExportOptions, ExportResult } from '../types'
import { formatDateAvid, secondToFrame } from '../timecode'

const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const exportToMediaComposerXml = (
  metadata: ExportAssetMetadata,
  comments: ExportCommentItem[],
  options?: ExportOptions,
): ExportResult => {
  void options
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<!DOCTYPE Avid:StreamItems SYSTEM "AvidSettingsFile.dtd">',
    '<Avid:StreamItems xmlns:Avid="http://www.avid.com">',
    '<Avid:XMLFileData>',
    '<AvProp name="DomainMagic" type="string">Domain</AvProp>',
    '<AvProp name="DomainKey" type="char4">58424a44</AvProp>',
  ]

  // Media Composer orders markers strictly by timeline frame (TC) ascending.
  // For non-timestamped markers on TC1, sequential frames (0, 1, 2...) are used to avoid frame collisions.
  const timed = comments.filter((c) => c.second !== null && c.second !== undefined)
  timed.sort((a, b) => (a.second ?? 0) - (b.second ?? 0))
  const notimed = comments.filter((c) => c.second === null || c.second === undefined)

  let notimedCounter = 0
  const allSortedWithTc = [
    ...notimed.map((c) => ({ comment: c, isTimed: false, tc: (notimedCounter++).toString() })),
    ...timed.map((c) => ({
      comment: c,
      isTimed: true,
      tc: secondToFrame(c.second, metadata.fps).toString(),
    })),
  ]

  allSortedWithTc.forEach(({ comment, isTimed, tc }) => {
    const color = isTimed ? 'Blue' : 'Magenta'
    const track = isTimed ? 'V1' : 'TC1'
    const createdEpoch = Math.floor(new Date(comment.createdAt).getTime() / 1000)

    // Collect unique authors in order
    const authors: string[] = [comment.creator.name]
    const replies = comment.replies || []
    replies.forEach((r) => {
      if (!authors.includes(r.creator.name)) {
        authors.push(r.creator.name)
      }
    })
    const userStr = escapeXml(authors.join(', '))

    let comStr: string
    if (!isTimed) {
      comStr = escapeXml(comment.message || '')
    } else {
      const hasAnnotation = Boolean(
        comment.annotations &&
        (Array.isArray(comment.annotations) ? comment.annotations.length > 0 : true),
      )
      const annotationPrefix = hasAnnotation ? '(Annotation) ' : ''
      const rootText = `${annotationPrefix}${comment.message || ''}`
      const formatLine = (name: string, date: Date, text: string): string => {
        return `[${escapeXml(name)} ${formatDateAvid(date)}] ${escapeXml(text)}`
      }

      const rootPart = formatLine(comment.creator.name, new Date(comment.createdAt), rootText)

      if (replies.length === 0) {
        comStr = rootPart
      } else {
        const parts = [rootPart]
        replies.forEach((r) => {
          parts.push(formatLine(r.creator.name, new Date(r.createdAt), r.message || ''))
        })
        // Format with space before newline as in Frame.io export
        comStr = parts.join(' \n')
      }
    }

    lines.push('<AvClass id="ATTR">')
    lines.push('  <AvProp id="ATTR" name="__OMFI:ATTR:NumItems" type="int32">7</AvProp>')
    lines.push('  <List id="OMFI:ATTR:AttrRefs">')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>')
    lines.push(
      '      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_LONG_CREATE_DATE</AvProp>',
    )
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">${createdEpoch}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">2</AvProp>')
    lines.push(
      '      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_COLOR</AvProp>',
    )
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:StringAttribute" type="string">${color}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">2</AvProp>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_USER</AvProp>')
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:StringAttribute" type="string">${userStr}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">2</AvProp>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_COM</AvProp>')
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:StringAttribute" type="string">${comStr}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">2</AvProp>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_TC</AvProp>')
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:StringAttribute" type="string">${tc}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">2</AvProp>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_TRK</AvProp>')
    lines.push(
      `      <AvProp id="ATTR" name="OMFI:ATTB:StringAttribute" type="string">${track}</AvProp>`,
    )
    lines.push('    </ListElem>')
    lines.push('    <ListElem>')
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>')
    lines.push(
      '      <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ATN_CRM_LENGTH</AvProp>',
    )
    lines.push('      <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>')
    lines.push('    </ListElem>')
    lines.push('    <ListElem/>')
    lines.push('  </List>')
    lines.push('</AvClass>')
  })

  lines.push('</Avid:XMLFileData></Avid:StreamItems>')
  lines.push('')

  const baseName = metadata.name.replace(/\.[^/.]+$/, '')
  return {
    content: lines.join('\n'),
    filename: `${baseName}_media-composer.xml`,
    mimeType: 'application/xml; charset=utf-8',
  }
}
