import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

// Uploaded as a binary file so no real transcode task races with the simulated mid-transcode
// state we set up directly in the database.
test.use({ fileOptions: { mediaType: 'binary' } })

test('shows the poster preview and a processing overlay while a video is still transcoding', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileId, fileName } = file

  // Simulate a video that is mid-transcode: the poster/sprite preview already exists, but the
  // asset is still marked as processing.
  const assetDir = `files/e2e/${fileId}`
  await prisma.asset.update({
    where: { id: fileId },
    data: {
      status: 'processing',
      mediaType: 'video/mp4',
      media: {
        duration: 10,
        filesize: 0,
        frames: 300,
        proxyType: 'video',
        imageTranscodes: [],
        videoTranscodes: [],
        sprite: { key: `${assetDir}/sprite.webp`, frames: 100, tileX: 10, tileY: 10 },
        poster: { key: `${assetDir}/poster.webp` },
        finishedAt: new Date().toISOString(),
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          hasAudio: false,
          duration: 10,
          bitRate: 0,
          frameRate: 30,
          totalFrames: 300,
          startTimecode: '00:00:00:00',
          format: {},
        },
        original: { key: `${assetDir}/original.mp4`, filesizeInBytes: 0, codec: '' },
      },
    },
  })

  await page.goto(`/projects/${projectId}`)

  const card = fileCard(page, fileName)
  await expect(card).toBeVisible()

  // The preview (poster thumbnail used as the sprite scrubber base) is rendered instead of a
  // blank placeholder.
  await expect(card.locator('img[alt="Thumbnail"]')).toBeVisible()

  // A processing overlay is shown on top of the visible preview.
  const overlay = card.getByTestId('file-card-processing-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay).toContainText(/Processing|处理中/i)
})
