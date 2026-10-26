import { z } from 'zod'

/** Strip optional/default wrappers to reach an object schema, if the field is one. */
function objectSchemaOf(schema: z.ZodType): z.ZodObject | undefined {
  let current: z.ZodType = schema
  while (current instanceof z.ZodOptional || current instanceof z.ZodDefault) {
    current = current.unwrap() as z.ZodType
  }
  return current instanceof z.ZodObject ? current : undefined
}

/**
 * Models often send `null` for optional parameters they don't want to set, including inside
 * nested config objects. Operation inputs are optional rather than nullable (nullable types
 * don't translate to every model's tool format), so drop those nulls before validating:
 * they are treated as omitted. Nulls for required fields are kept and still fail validation.
 */
export function dropNullOptionals(schema: z.ZodObject, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const shape = schema.shape as Record<string, z.ZodType>
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    const fieldSchema = shape[key]
    if (field === null && fieldSchema?.safeParse(undefined).success) continue
    const nested = fieldSchema && objectSchemaOf(fieldSchema)
    result[key] = nested ? dropNullOptionals(nested, field) : field
  }
  return result
}
