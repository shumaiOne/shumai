/**
 * | output |
 * | --- |
 * | "Permanently deleted" |
 *
 * @param {Permanently_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const permanently_deleted: ((
  inputs?: Permanently_DeletedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Permanently_DeletedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Permanently_DeletedInputs = {}
