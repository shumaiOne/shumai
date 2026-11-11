import { describe, expect, it } from 'vitest'
import { getServerQueues } from './workers'

describe('server queues', () => {
  it.each(['none', 'agent', 'ai', 'archive'])(
    'keeps agent and archive embedded for %s',
    (option) => {
      expect(getServerQueues(option)).toEqual(['agent_queue', 'archive_queue'])
    },
  )

  it.each(['all', 'transcode'])('also processes local transcoding for %s', (option) => {
    expect(getServerQueues(option)).toEqual(['agent_queue', 'archive_queue', 'transcode_queue'])
  })
})
