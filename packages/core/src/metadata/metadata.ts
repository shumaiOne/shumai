import { prisma } from '@shumai/db'
import {
  CreateFieldRequest,
  ProjectFieldOrder,
  UpdateAssetMetadataRequest,
  UpdateFieldRequest,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { ulid } from 'ulid'
import { assetService } from '../asset/asset'
import { systemFields } from './system_fields'

export const FIELD_COLORS = [
  '#f43f5e', // rose
  '#ec4899', // pink
  '#d946ef', // fuchsia
  '#a855f7', // purple
  '#8b5cf6', // violet
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#22c55e', // green
  '#84cc16', // lime
  '#eab308', // yellow
  '#f59e0b', // amber
  '#f97316', // orange
  '#71717a', // zinc
  '#64748b', // slate
]

export function getNextOptionColor(existingOptions: PrismaJson.SelectOption[] = []): string {
  const usedColors = new Set(existingOptions.map((o) => o.color))
  const available = FIELD_COLORS.filter((c) => !usedColors.has(c))
  if (available.length > 0) {
    return available[0]
  }
  return FIELD_COLORS[existingOptions.length % FIELD_COLORS.length]
}

export class MetadataService {
  constructor(private client: typeof prisma = prisma) {}
  async syncSystemFields(): Promise<void> {
    await this.client.$transaction(async (tx) => {
      for (const field of systemFields) {
        await tx.metadataField.upsert({
          where: { key: field.key },
          update: {
            scope: field.scope,
            readOnly: field.readOnly,
            config: field.config,
          },
          create: {
            key: field.key,
            scope: field.scope,
            readOnly: field.readOnly ?? false,
            config: field.config,
          },
        })
      }
    })
  }

  async createTeamField(
    teamId: string,
    req: CreateFieldRequest,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>>> {
    const f = await this.client.metadataField.create({
      data: {
        key: ulid(),
        scope: 'TEAM',
        teamId: teamId,
        config: req.config,
        description: req.description,
      },
    })
    return f
  }

  async listTeamFields(
    teamId: string,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>>[]> {
    const fields = await this.client.metadataField.findMany({
      where: {
        OR: [
          { scope: 'SYSTEM' },
          {
            AND: [{ scope: 'TEAM' }, { teamId: teamId }],
          },
        ],
      },
    })
    return fields
  }

  async getFieldByKey(
    key: string,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>> | null> {
    return this.client.metadataField.findUnique({
      where: { key },
    })
  }

  async updateTeamField(
    teamId: string,
    fieldId: string,
    req: UpdateFieldRequest,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>>> {
    const field = await this.client.metadataField.findUnique({
      where: { key: fieldId },
    })
    if (!field) throw new Error('Field not found')
    if (field.teamId !== teamId) throw new Error('Field does not belong to this team')

    const updated = await this.client.metadataField.update({
      where: { id: field.id },
      data: {
        config: req.config,
        description: req.description ?? field.description,
      },
    })
    return updated
  }

  async deleteTeamField(teamId: string, fieldId: string): Promise<void> {
    const field = await this.client.metadataField.findUnique({
      where: { key: fieldId },
    })
    if (!field) throw new Error('Field not found')
    if (field.teamId !== teamId) throw new Error('Field does not belong to this team')

    await this.client.metadataField.delete({
      where: { key: fieldId },
    })
  }

  async createProjectField(
    projectId: string,
    req: CreateFieldRequest,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>>> {
    const p = await this.client.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    if (!p) throw new Error('Project not found')

    const f = await this.client.metadataField.create({
      data: {
        key: ulid(),
        scope: 'PROJECT',
        projectId: projectId,
        teamId: p.teamId,
        config: req.config,
        description: req.description,
      },
    })
    return f
  }

  async listProjectFields(
    userId: string | null,
    projectId: string,
  ): Promise<{ field: Prisma.MetadataFieldGetPayload<Record<string, never>>; visible: boolean }[]> {
    const p = await this.client.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    if (!p) throw new Error('Project not found')

    const fields = await this.client.metadataField.findMany({
      where: {
        OR: [
          { scope: 'SYSTEM' },
          {
            AND: [{ scope: 'TEAM' }, { teamId: p.teamId }],
          },
          {
            AND: [{ scope: 'PROJECT' }, { projectId: projectId }],
          },
        ],
      },
    })

    const order = userId ? await this.getProjectFieldsOrder(userId, projectId) : []
    const orderMap = new Map<string, number>()
    order.forEach((o, index) => {
      orderMap.set(o.fieldId, index)
    })

    const visibleMap = new Map<string, boolean>()
    order.forEach((o) => {
      visibleMap.set(o.fieldId, o.visible)
    })

    const res = fields.map((f) => ({
      field: f,
      visible: visibleMap.has(f.key) ? visibleMap.get(f.key)! : userId === null, // All fields visible by default for public if not ordered
    }))

    res.sort((a, b) => {
      const aOrder = orderMap.get(a.field.key)
      const bOrder = orderMap.get(b.field.key)
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder
      }
      if (aOrder !== undefined) return -1
      if (bOrder !== undefined) return 1
      const aName = a.field.config?.name || ''
      const bName = b.field.config?.name || ''
      return aName.localeCompare(bName)
    })

    return res
  }

  private async getProjectFieldsOrder(
    userId: string,
    projectId: string,
  ): Promise<ProjectFieldOrder[]> {
    const key = this.getProjectFieldOrderKey(userId, projectId)
    const m = await this.client.systemSettings.findUnique({
      where: { key },
    })
    if (!m || !m.value) return []

    const order = m.value as ProjectFieldOrder[]
    return order
  }

  async updateProjectFieldsOrder(
    userId: string,
    projectId: string,
    order: ProjectFieldOrder[],
  ): Promise<void> {
    const key = this.getProjectFieldOrderKey(userId, projectId)
    await this.client.systemSettings.upsert({
      where: { key },
      create: {
        key,
        value: order,
      },
      update: {
        value: order,
      },
    })
  }

  private getProjectFieldOrderKey(userId: string, projectId: string): string {
    return `project_field_order:${userId}:${projectId}`
  }

  async updateProjectField(
    projectId: string,
    fieldId: string, // actually 'key'
    req: UpdateFieldRequest,
  ): Promise<Prisma.MetadataFieldGetPayload<Record<string, never>>> {
    const field = await this.client.metadataField.findUnique({
      where: { key: fieldId },
    })
    if (!field) throw new Error('Field not found')
    if (field.projectId !== projectId) throw new Error('Field does not belong to this project')

    const updated = await this.client.metadataField.update({
      where: { id: field.id },
      data: {
        config: req.config,
        description: req.description ?? field.description,
      },
    })
    return updated
  }

  async deleteProjectField(projectId: string, fieldId: string): Promise<void> {
    const field = await this.client.metadataField.findUnique({
      where: { key: fieldId },
    })
    if (!field) throw new Error('Field not found')
    if (field.projectId !== projectId) throw new Error('Field does not belong to this project')

    await this.client.metadataField.delete({
      where: { key: fieldId },
    })
  }

  async updateAssetMetadata(
    assetId: string,
    reqs: UpdateAssetMetadataRequest[],
    allowReadOnly = false,
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await this.updateAssetMetadataInternal(tx, assetId, reqs, allowReadOnly)
    })
  }

  /**
   * Same as {@link updateAssetMetadata} but runs inside the caller's transaction,
   * keeping the metadata write atomic with the surrounding changes.
   */
  async updateAssetMetadataInTx(
    tx: Prisma.TransactionClient,
    assetId: string,
    reqs: UpdateAssetMetadataRequest[],
    allowReadOnly = false,
  ): Promise<void> {
    await this.updateAssetMetadataInternal(tx, assetId, reqs, allowReadOnly)
  }

  private async resolveOrCreateOption(
    client: Prisma.TransactionClient | typeof prisma,
    field: Prisma.MetadataFieldGetPayload<Record<string, never>>,
    rawOption: unknown,
  ): Promise<string> {
    if (
      typeof rawOption !== 'object' ||
      rawOption === null ||
      !('newOption' in rawOption) ||
      typeof (rawOption as { newOption?: unknown }).newOption !== 'object' ||
      (rawOption as { newOption?: unknown }).newOption === null
    ) {
      throw new Error(`Invalid newOption object for field ${field.key}`)
    }

    const value = (rawOption as { newOption: { value?: unknown } }).newOption.value
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `Invalid newOption value for field ${field.key}: value must be a non-empty string`,
      )
    }

    const trimmedValue = value.trim()
    const config = (field.config ?? {}) as PrismaJson.FieldConfig
    const isMulti = config.type === 'selectMulti'
    const existingOptions: PrismaJson.SelectOption[] =
      (isMulti ? config.selectMulti?.options : config.select?.options) ?? []

    // 1. Check for case-insensitive match against existing options (id or displayName)
    const existing = existingOptions.find(
      (opt) =>
        opt.id.toLowerCase() === trimmedValue.toLowerCase() ||
        opt.displayName.toLowerCase() === trimmedValue.toLowerCase(),
    )
    if (existing) {
      return existing.id
    }

    // 2. Generate slug id
    let baseId = trimmedValue.toLowerCase().replace(/\s+/g, '-')
    if (!baseId) {
      baseId = ulid().toLowerCase()
    }

    let candidateId = baseId
    let suffix = 1
    while (existingOptions.some((opt) => opt.id === candidateId)) {
      candidateId = `${baseId}-${suffix}`
      suffix++
    }

    const newOption: PrismaJson.SelectOption = {
      id: candidateId,
      displayName: trimmedValue,
      color: getNextOptionColor(existingOptions),
    }

    const updatedOptions = [...existingOptions, newOption]
    const updatedConfig: PrismaJson.FieldConfig = {
      ...config,
      name: config.name ?? field.key,
      type: config.type ?? (isMulti ? 'selectMulti' : 'select'),
      ...(isMulti
        ? { selectMulti: { ...(config.selectMulti ?? {}), options: updatedOptions } }
        : { select: { ...(config.select ?? {}), options: updatedOptions } }),
    }

    await client.metadataField.update({
      where: { key: field.key },
      data: { config: updatedConfig },
    })

    // Update in-memory field.config for subsequent iterations in the same transaction
    field.config = updatedConfig

    return candidateId
  }

  private async updateAssetMetadataInternal(
    client: Prisma.TransactionClient | typeof prisma,
    assetId: string,
    reqs: UpdateAssetMetadataRequest[],
    allowReadOnly: boolean,
  ): Promise<void> {
    const resolvedAssetId = await assetService.resolveLatestVersionId(assetId)

    for (const req of reqs) {
      const field = await client.metadataField.findUnique({
        where: { key: req.key },
      })
      if (field?.readOnly && !allowReadOnly) {
        throw new Error(`Field ${field.key} is read-only`)
      }

      let value = req.value
      const config = field?.config as PrismaJson.FieldConfig | null

      if (
        field &&
        config?.type === 'select' &&
        typeof value === 'object' &&
        value !== null &&
        'newOption' in value
      ) {
        value = await this.resolveOrCreateOption(client, field, value)
      } else if (field && config?.type === 'selectMulti' && Array.isArray(value)) {
        const resolvedList: string[] = []
        for (const item of value) {
          if (typeof item === 'object' && item !== null && 'newOption' in item) {
            const resolvedId = await this.resolveOrCreateOption(client, field, item)
            resolvedList.push(resolvedId)
          } else if (typeof item === 'string') {
            resolvedList.push(item)
          }
        }
        value = resolvedList
      }

      let stringValue: string | null = null
      let numberValue: number | null = null
      let booleanValue: boolean | null = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let jsonValue: any = null
      let dateValue: Date | null = null

      if (typeof value === 'string') {
        // Check if it's a valid ISO date string
        const date = new Date(value)
        if (!isNaN(date.getTime()) && value.includes('T') && value.includes('-')) {
          dateValue = date
        } else {
          stringValue = value
        }
      } else if (typeof value === 'number') {
        numberValue = value
      } else if (typeof value === 'boolean') {
        booleanValue = value
      } else if (value instanceof Date) {
        dateValue = value
      } else if (Array.isArray(value)) {
        jsonValue = value
      } else if (value === null) {
        // all null
      } else if (typeof value === 'object') {
        jsonValue = value
      } else {
        stringValue = String(value)
      }

      await client.assetMetadataValue.upsert({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          assetId_fieldKey: {
            assetId: resolvedAssetId,
            fieldKey: req.key,
          },
        },
        create: {
          assetId: resolvedAssetId,
          fieldKey: req.key,
          stringValue,
          numberValue,
          booleanValue,
          jsonValue,
          dateValue,
        },
        update: {
          stringValue,
          numberValue,
          booleanValue,
          jsonValue,
          dateValue,
        },
      })
    }

    // Touch asset
    await client.asset.update({
      where: { id: resolvedAssetId },
      data: {
        updatedAt: new Date(),
      },
    })
  }
}

export const metadataService = new MetadataService()
