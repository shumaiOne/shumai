import type { Prisma } from '@/generated/prisma/client.ts'
import '@shumai/db/src/prisma-json-types'

export const systemFields: Prisma.MetadataFieldCreateInput[] = [
  {
    key: 'file_size',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'File Size',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'resolution_width',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Resolution Width',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'resolution_height',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Resolution Height',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'name',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Name',
      type: 'text',
      text: {},
    },
  },
  {
    key: 'rating',
    scope: 'SYSTEM',
    readOnly: false,
    config: {
      name: 'Rating',
      type: 'rating',
      rating: { maxValue: 5 },
    },
  },
  {
    key: 'duration',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Duration',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'bitRate',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Bit Rate',
      type: 'number',
      number: { scale: 1 },
    },
  },
  {
    key: 'frame_rate',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Frame Rate',
      type: 'number',
      number: { scale: 3 },
    },
  },
  {
    key: 'keywords',
    scope: 'SYSTEM',
    readOnly: false,
    config: {
      name: 'Keywords',
      type: 'selectMulti',
      selectMulti: {
        options: [],
      },
    },
  },
  {
    key: 'file_type',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'File Type',
      type: 'select',
      select: {
        options: [
          { id: 'video', displayName: 'Video', color: 'system' },
          { id: 'audio', displayName: 'Audio', color: 'system' },
          { id: 'image', displayName: 'Image', color: 'system' },
          { id: 'document', displayName: 'Document', color: 'system' },
          { id: 'file', displayName: 'File', color: 'system' },
        ],
      },
    },
  },
  {
    key: 'audio_bit_depth',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Audio Bit Depth',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'audio_channels',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Audio Channels',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'audio_codec',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Audio Codec',
      type: 'text',
      text: {},
    },
  },
  {
    key: 'audio_sample_rate',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Audio Sample Rate',
      type: 'number',
      number: { scale: 0 },
    },
  },
  {
    key: 'video_codec',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Video Codec',
      type: 'text',
      text: {},
    },
  },
  {
    key: 'format',
    scope: 'SYSTEM',
    readOnly: true,
    config: {
      name: 'Format',
      type: 'text',
      text: {},
    },
  },
  {
    key: 'status',
    scope: 'SYSTEM',
    readOnly: false,
    config: {
      name: 'Status',
      type: 'select',
      select: {
        options: [
          { id: 'needs_review', displayName: 'Needs Review', color: 'red' },
          { id: 'in_progress', displayName: 'In Progress', color: 'yellow' },
          { id: 'approved', displayName: 'Approved', color: 'green' },
        ],
      },
    },
  },
]
