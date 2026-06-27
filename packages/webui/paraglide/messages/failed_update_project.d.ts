/**
 * | output |
 * | --- |
 * | "Failed to update project" |
 *
 * @param {Failed_Update_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_update_project: ((
  inputs?: Failed_Update_ProjectInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_Update_ProjectInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_Update_ProjectInputs = {}
