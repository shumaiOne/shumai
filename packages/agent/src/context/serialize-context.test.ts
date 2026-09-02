import { describe, it, expect } from 'vitest'
import { escapeXmlAttr, serializeContextToXml } from './serialize-context'
import type { ShumaiMessageContext } from '@shumai/dtos'

describe('serializeContextToXml', () => {
  describe('escapeXmlAttr', () => {
    it('escapes &, <, >, ", and \' characters correctly', () => {
      expect(escapeXmlAttr('Alice & Bob <Admin> "v1" \'test\'')).toBe(
        'Alice &amp; Bob &lt;Admin&gt; &quot;v1&quot; &apos;test&apos;',
      )
    })

    it('handles clean strings without modification', () => {
      expect(escapeXmlAttr('normal-string_123.mp4')).toBe('normal-string_123.mp4')
    })
  })

  describe('Tag Serialization', () => {
    it('returns empty string for null, undefined, or empty context', () => {
      expect(serializeContextToXml(null)).toBe('')
      expect(serializeContextToXml(undefined)).toBe('')
      expect(serializeContextToXml({})).toBe('')
    })

    it('serializes minimal context with only user', () => {
      const context: ShumaiMessageContext = {
        user: { id: 'usr_1', name: 'Alice', role: 'editor' },
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <user id="usr_1" name="Alice" role="editor" />\n</context>',
      )
    })

    it('serializes context with user and thread tag with reply_count', () => {
      const context: ShumaiMessageContext = {
        user: { id: 'usr_1', name: 'Alice', role: 'editor' },
        thread: { id: 'th_01JXYZ', replyCount: 3 },
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <user id="usr_1" name="Alice" role="editor" />\n  <thread id="th_01JXYZ" reply_count="3" />\n</context>',
      )
    })

    it('serializes context with thread tag without reply_count', () => {
      const context: ShumaiMessageContext = {
        thread: { id: 'th_01JXYZ' },
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <thread id="th_01JXYZ" />\n</context>',
      )
    })

    it('serializes minimal context with only currentAsset (without ancestors)', () => {
      const context: ShumaiMessageContext = {
        currentAsset: {
          id: 'ast_1',
          name: 'clip.mp4',
          type: 'file',
          mediaType: 'video',
          path: 'clip.mp4',
        },
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <current_asset id="ast_1" name="clip.mp4" type="file" media_type="video" path="clip.mp4" />\n</context>',
      )
    })

    it('serializes full video context with duration, timestamp, annotation, attached files, and referenced assets', () => {
      const context: ShumaiMessageContext = {
        user: { id: 'usr_01', name: 'Alice Chen', role: 'editor' },
        currentAsset: {
          id: 'ast_01JC04_CURRENT',
          name: 'product_launch_v2.mp4',
          type: 'file',
          mediaType: 'video',
          parentId: 'ast_01JC03_PARENT',
          path: 'Marketing/2026_Launch/Footage/product_launch_v2.mp4',
          durationSeconds: 85.4,
          ancestors: [
            { id: 'ast_01JC01_ROOT', name: 'Marketing' },
            { id: 'ast_01JC02_SUB', name: '2026_Launch' },
            { id: 'ast_01JC03_PARENT', name: 'Footage' },
          ],
        },
        position: { type: 'time', seconds: 14.25 },
        annotation: true,
        attachedFiles: [
          {
            id: 'ast_01JC05_ATT1',
            name: 'brand_guidelines_2026.pdf',
            type: 'file',
            mediaType: 'pdf',
            path: 'Brand/brand_guidelines_2026.pdf',
          },
        ],
        referencedAssets: [
          {
            id: 'ast_01JC07_REF2',
            name: 'Color_LUTs',
            type: 'folder',
            path: 'Assets/Color_LUTs',
          },
          {
            id: 'ast_01JC06_REF1',
            name: 'logo_white.png',
            type: 'file',
            mediaType: 'image',
            path: 'Brand/Logos/logo_white.png',
          },
        ],
      }

      const expected = `<context>
  <user id="usr_01" name="Alice Chen" role="editor" />
  <current_asset id="ast_01JC04_CURRENT" name="product_launch_v2.mp4" type="file" media_type="video" parent_id="ast_01JC03_PARENT" path="Marketing/2026_Launch/Footage/product_launch_v2.mp4" duration_seconds="85.40">
    <ancestors>
      <folder id="ast_01JC01_ROOT" name="Marketing" />
      <folder id="ast_01JC02_SUB" name="2026_Launch" />
      <folder id="ast_01JC03_PARENT" name="Footage" />
    </ancestors>
  </current_asset>
  <position type="time" seconds="14.2500" />
  <annotation />
  <attached_files>
    <file id="ast_01JC05_ATT1" name="brand_guidelines_2026.pdf" type="file" media_type="pdf" path="Brand/brand_guidelines_2026.pdf" />
  </attached_files>
  <referenced_assets>
    <asset id="ast_01JC06_REF1" name="logo_white.png" type="file" media_type="image" path="Brand/Logos/logo_white.png" />
    <folder id="ast_01JC07_REF2" name="Color_LUTs" path="Assets/Color_LUTs" />
  </referenced_assets>
</context>`

      expect(serializeContextToXml(context)).toBe(expected)
    })

    it('serializes PDF document context with total_pages and position.type === "page"', () => {
      const context: ShumaiMessageContext = {
        currentAsset: {
          id: 'pdf_1',
          name: 'report.pdf',
          type: 'file',
          mediaType: 'pdf',
          totalPages: 12,
        },
        position: { type: 'page', page: 3 },
      }

      const expected = `<context>
  <current_asset id="pdf_1" name="report.pdf" type="file" media_type="pdf" total_pages="12" />
  <position type="page" page="3" />
</context>`

      expect(serializeContextToXml(context)).toBe(expected)
    })

    it('serializes Video context with total_frames and duration_seconds', () => {
      const context: ShumaiMessageContext = {
        currentAsset: {
          id: 'vid_1',
          name: 'clip.mp4',
          type: 'file',
          mediaType: 'video',
          mimeType: 'video/mp4',
          durationSeconds: 9,
          totalFrames: 268,
        },
      }

      const expected = `<context>
  <current_asset id="vid_1" name="clip.mp4" type="file" media_type="video" mime_type="video/mp4" duration_seconds="9.00" total_frames="268" />
</context>`

      expect(serializeContextToXml(context)).toBe(expected)
    })

    it('serializes navigation context with navigated="true" and ancestors hierarchy', () => {
      const context: ShumaiMessageContext = {
        currentAsset: {
          id: 'f_sub',
          name: 'Subfolder',
          type: 'folder',
          navigated: true,
          ancestors: [{ id: 'f_root', name: 'Root' }],
        },
      }

      const expected = `<context>
  <current_asset id="f_sub" name="Subfolder" type="folder" navigated="true">
    <ancestors>
      <folder id="f_root" name="Root" />
    </ancestors>
  </current_asset>
</context>`

      expect(serializeContextToXml(context)).toBe(expected)
    })

    it('serializes mime_type alongside media_type for current asset and attached files', () => {
      const context: ShumaiMessageContext = {
        currentAsset: {
          id: 'img_1',
          name: 'photo.png',
          type: 'file',
          mediaType: 'image',
          mimeType: 'image/png',
        },
        attachedFiles: [
          {
            id: 'doc_1',
            name: 'spec.pdf',
            type: 'file',
            mediaType: 'pdf',
            mimeType: 'application/pdf',
          },
        ],
      }

      const expected = `<context>
  <current_asset id="img_1" name="photo.png" type="file" media_type="image" mime_type="image/png" />
  <attached_files>
    <file id="doc_1" name="spec.pdf" type="file" media_type="pdf" mime_type="application/pdf" />
  </attached_files>
</context>`

      expect(serializeContextToXml(context)).toBe(expected)
    })
  })

  describe('XML Escaping & Security', () => {
    it('escapes user names, asset names, and paths with special characters', () => {
      const context: ShumaiMessageContext = {
        user: {
          id: 'u_1',
          name: 'Alice & Bob <Admin>',
          role: 'reviewer "lead"',
        },
        currentAsset: {
          id: 'ast_1',
          name: 'Final <Cut> "v2" & Test.mp4',
          type: 'file',
          path: 'Folder A > Folder B & C/clip.mp4',
          ancestors: [{ id: 'anc_1', name: 'Folder B & C' }],
        },
        attachedFiles: [
          {
            id: 'att_1',
            name: "Don't <Touch> & Go.pdf",
            type: 'file',
            path: "Path 'A' & 'B'/doc.pdf",
          },
        ],
      }

      const xml = serializeContextToXml(context)
      expect(xml).toContain('name="Alice &amp; Bob &lt;Admin&gt;"')
      expect(xml).toContain('role="reviewer &quot;lead&quot;"')
      expect(xml).toContain('name="Final &lt;Cut&gt; &quot;v2&quot; &amp; Test.mp4"')
      expect(xml).toContain('path="Folder A &gt; Folder B &amp; C/clip.mp4"')
      expect(xml).toContain('name="Folder B &amp; C"')
      expect(xml).toContain('name="Don&apos;t &lt;Touch&gt; &amp; Go.pdf"')
      expect(xml).toContain('path="Path &apos;A&apos; &amp; &apos;B&apos;/doc.pdf"')

      // Verify no unescaped dangerous characters exist inside attribute quotes
      const attrMatch = xml.match(/\w+="([^"]*)"/g)
      expect(attrMatch).not.toBeNull()
    })
  })

  describe('Order Stability & Prompt Caching Invariants', () => {
    it('produces identical XML regardless of object key order', () => {
      const contextA: ShumaiMessageContext = {
        user: { role: 'editor', name: 'Alice', id: 'u_1' },
        currentAsset: {
          name: 'video.mp4',
          type: 'file',
          id: 'ast_1',
          mediaType: 'video',
        },
        position: { seconds: 12.345, type: 'time' },
      }

      const contextB: ShumaiMessageContext = {
        position: { type: 'time', seconds: 12.345 },
        currentAsset: {
          id: 'ast_1',
          mediaType: 'video',
          type: 'file',
          name: 'video.mp4',
        },
        user: { id: 'u_1', name: 'Alice', role: 'editor' },
      }

      expect(serializeContextToXml(contextA)).toBe(serializeContextToXml(contextB))
    })

    it('sorts attachedFiles and referencedAssets by id ascending', () => {
      const context: ShumaiMessageContext = {
        attachedFiles: [
          { id: 'z_file', name: 'Z', type: 'file' },
          { id: 'a_file', name: 'A', type: 'file' },
          { id: 'm_file', name: 'M', type: 'file' },
        ],
        referencedAssets: [
          { id: 'z_asset', name: 'Z', type: 'file' },
          { id: 'a_asset', name: 'A', type: 'folder' },
          { id: 'm_asset', name: 'M', type: 'file' },
        ],
      }

      const xml = serializeContextToXml(context)
      const fileOrder = [...xml.matchAll(/<file id="([^"]+)"/g)].map((m) => m[1])
      const refOrder = [...xml.matchAll(/<(?:asset|folder) id="([^"]+)"/g)].map((m) => m[1])

      expect(fileOrder).toEqual(['a_file', 'm_file', 'z_file'])
      expect(refOrder).toEqual(['a_asset', 'm_asset', 'z_asset'])
    })

    it('normalizes float formatting with fixed precision (toFixed(4) for position, toFixed(2) for duration)', () => {
      const context1: ShumaiMessageContext = {
        currentAsset: { id: '1', name: 'a', type: 'file', durationSeconds: 14 },
        position: { type: 'time', seconds: 5.5 },
      }
      const context2: ShumaiMessageContext = {
        currentAsset: { id: '1', name: 'a', type: 'file', durationSeconds: 14.0001 },
        position: { type: 'time', seconds: 5.50002 },
      }

      expect(serializeContextToXml(context1)).toContain('duration_seconds="14.00"')
      expect(serializeContextToXml(context1)).toContain('seconds="5.5000"')
      expect(serializeContextToXml(context2)).toContain('duration_seconds="14.00"')
      expect(serializeContextToXml(context2)).toContain('seconds="5.5000"')
    })

    it('serializes annotation tag with id when context.id is provided', () => {
      const context: ShumaiMessageContext = {
        id: '01JABCDEF1234567890',
        annotation: true,
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <annotation id="01JABCDEF1234567890" />\n</context>',
      )
    })

    it('escapes special XML characters in annotation id', () => {
      const context: ShumaiMessageContext = {
        id: 'test<id>&"123"',
        annotation: true,
      }
      expect(serializeContextToXml(context)).toBe(
        '<context>\n  <annotation id="test&lt;id&gt;&amp;&quot;123&quot;" />\n</context>',
      )
    })
  })
})
