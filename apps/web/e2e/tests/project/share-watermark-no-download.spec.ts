import { expect, test } from '../../fixtures'
import {
  apiAddAssetsToShare,
  apiCreateShare,
  apiEnableShareWatermark,
  apiPublicDownloadUrl,
  apiUpdateShare,
  fileCard,
} from '../../helpers/files'

/**
 * The watermarked + download-disabled combination is frequently used together:
 * guests can preview the content but never download it, and any previewed proxy
 * carries a watermark. This covers both watermarkable media types (image and
 * video) and asserts, per type:
 *  - the public share list page exposes no download affordance,
 *  - the public share file detail page exposes no download affordance,
 *  - the proxy loaded in the detail page is the watermarked version, and
 *  - the download-url endpoint rejects guest download attempts with 403.
 */
for (const mediaType of ['image', 'video'] as const) {
  // NOTE: `test.use` must be scoped per describe block — a bare `test.use`
  // inside a `for` loop leaks the last iteration's value to every test.
  test.describe(`${mediaType} share`, () => {
    test.use({ fileOptions: { mediaType } })

    // Transcoding (original + watermark) happens through the local workflow
    // executor, so this test needs a much larger budget than the 60s default.
    test.setTimeout(300_000)

    test('with watermark + download disabled: no download buttons, watermarked proxy', async ({
      file,
      browser,
      prisma,
    }) => {
      const { context, projectId, fileName, fileId } = file

      // The watermark transcode re-encodes from the existing transcode slots, so
      // the original transcode must finish first.
      await expect
        .poll(
          async () => {
            const asset = await prisma.asset.findUnique({ where: { id: fileId } })
            return asset?.status
          },
          { timeout: 60_000 },
        )
        .toBe('processed')

      // Seed the share through the API (setup, not the flow under test)
      const share = await apiCreateShare(context.request, projectId, 'Watermarked Share')
      await apiAddAssetsToShare(context.request, share.id, [fileId])
      await apiUpdateShare(context.request, share.id, { allowDownload: false })
      await apiEnableShareWatermark(context.request, share.id)

      // Wait for the watermark transcode to complete and the share to be ready
      await expect
        .poll(
          async () => {
            const link = await prisma.shareLink.findUnique({ where: { id: share.id } })
            return link?.watermarkStatus
          },
          { timeout: 120_000 },
        )
        .toBe('ready')

      const saved = await prisma.shareLink.findUnique({ where: { id: share.id } })
      expect(saved?.allowDownload).toBe(false)
      expect(saved?.watermarkConfigId).not.toBeNull()

      // The share root contains a symlink pointing at the real asset; the public
      // detail page navigates with the symlink id (mirrors the real double-click flow).
      const symlink = await prisma.asset.findFirst({
        where: { parentId: share.rootFolderId, targetId: fileId },
      })
      expect(symlink).not.toBeNull()

      // Original (unwatermarked) transcode keys, to prove they are never served
      const asset = await prisma.asset.findUnique({ where: { id: fileId } })
      const media = asset?.media as {
        imageTranscodes?: Array<{ key: string }>
        videoTranscodes?: Array<{ key: string }>
        original?: { key: string } | null
      } | null
      const originalKeys =
        (mediaType === 'image' ? media?.imageTranscodes : media?.videoTranscodes)?.map(
          (t) => t.key,
        ) ?? []

      const guestContext = await browser.newContext()
      const guestPage = await guestContext.newPage()
      try {
        // ---------------- Public share list page ----------------
        await guestPage.goto(`/share/${share.id}`)
        await expect(fileCard(guestPage, fileName)).toBeVisible()

        // Card context menu: no Download item
        const card = fileCard(guestPage, fileName)
        const kebab = card.locator('button', {
          has: guestPage.locator('svg.lucide-ellipsis'),
        })
        await kebab.click()
        await expect(guestPage.locator('[data-radix-menu-content]').first()).toBeAttached()
        await expect(guestPage.getByRole('menuitem', { name: 'Download' })).toHaveCount(0)
        await guestPage.keyboard.press('Escape')
        // Wait for the Radix menu to fully unmount before interacting again:
        // while its exit animation is running its dismiss layer can intercept
        // the outside pointerdown and swallow the next click.
        await guestPage
          .waitForFunction(() => !document.querySelector('[data-radix-menu-content]'), null, {
            timeout: 10_000,
          })
          .catch(() => {})

        // Selection bar: selecting the file must not surface a Download button.
        // Click the card checkbox (selects directly) instead of the card body:
        // the preview area (video sprite scrubber) re-renders on hover and can
        // race with a body click.
        const checkbox = card.getByRole('checkbox')
        await checkbox.click()
        await expect(guestPage.getByText(/1 file selected/)).toBeVisible()
        await expect(guestPage.getByRole('button', { name: 'Download' })).toHaveCount(0)

        // ---------------- Public share file detail page ----------------
        // Capture every network request so we can prove the loaded proxy is the
        // watermarked one and no original transcode key is ever requested.
        const watermarkedRequests: string[] = []
        const allRequests: string[] = []
        guestPage.on('request', (req) => {
          const url = req.url()
          allRequests.push(url)
          if (url.includes('-watermark-')) watermarkedRequests.push(url)
        })

        const detailFileId = symlink!.id
        await guestPage.goto(`/share/${share.id}/files/${detailFileId}`)

        // The viewer (image canvas / video element) renders the proxy
        if (mediaType === 'image') {
          await expect(guestPage.locator('canvas').first()).toBeVisible({ timeout: 30_000 })
        } else {
          await expect(guestPage.locator('video').first()).toBeVisible({ timeout: 30_000 })
        }

        // The proxy actually loaded is the watermarked version, and no original
        // (unwatermarked) transcode key was requested
        await expect.poll(() => watermarkedRequests.length, { timeout: 30_000 }).toBeGreaterThan(0)
        const leaked = allRequests.filter((url) => originalKeys.some((key) => url.includes(key)))
        expect(leaked).toEqual([])

        // No download affordance in the viewer control bar
        await expect(guestPage.getByTitle('Download')).toHaveCount(0)
        await expect(guestPage.getByTitle('Download original image')).toHaveCount(0)
        await expect(guestPage.getByRole('button', { name: 'Download' })).toHaveCount(0)

        // Top-nav file dropdown: no Download item (video: also no resolution submenu)
        await guestPage.getByRole('button', { name: new RegExp(fileName) }).click()
        await expect(guestPage.locator('[data-radix-menu-content]').first()).toBeAttached()
        await expect(guestPage.getByRole('menuitem', { name: 'Download' })).toHaveCount(0)
        if (mediaType === 'video') {
          await expect(
            guestPage.locator('[data-radix-menu-content]').getByText('Original', { exact: true }),
          ).toHaveCount(0)
          await expect(
            guestPage.locator('[data-radix-menu-content]').getByText('MP4', { exact: true }),
          ).toHaveCount(0)
        }

        // ---------------- Backend enforcement ----------------
        // Guests cannot obtain a download URL even when they know the storage key
        const originalKey = originalKeys[0] || media?.original?.key || ''
        const download = await apiPublicDownloadUrl(
          guestContext.request,
          share.id,
          detailFileId,
          originalKey,
        )
        expect(download.status).toBe(403)
      } finally {
        await guestContext.close()
      }
    })
  })
}
