import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

// Uploaded as a binary file so no real transcode task races with the simulated mid-transcode
// state we set up directly in the database.
test.use({ fileOptions: { mediaType: 'binary' } })

test('shows the poster preview and "Preparing..." while a video is still transcoding', async ({
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
  // blank placeholder, and its opacity breathes while transcoding is in progress.
  await expect(card.locator('img[alt="Thumbnail"]')).toBeVisible()
  await expect(card.getByTestId('file-card-preview-media')).toHaveClass(/animate-pulse/)

  // The creator row is replaced by a "Preparing..." label while transcoding.
  await expect(card.getByText(/Preparing|准备中/i)).toBeVisible()

  // The duration badge is hidden until the asset is ready.
  await expect(card.getByText('00:10')).toHaveCount(0)
})

test('shows a preparing circle before the poster is generated', async ({ file, prisma }) => {
  const { page, projectId, fileId, fileName } = file

  // Simulate an asset whose upload finished but whose poster does not exist yet.
  await prisma.asset.update({
    where: { id: fileId },
    data: { status: 'processing', mediaType: 'video/mp4' },
  })

  await page.goto(`/projects/${projectId}`)

  const card = fileCard(page, fileName)
  await expect(card).toBeVisible()

  // A size-breathing circle stands in until the poster is available, with a "Preparing..." label.
  await expect(card.getByTestId('file-card-preparing-circle')).toBeVisible()
  await expect(card.getByText(/Preparing|准备中/i)).toBeVisible()
})
