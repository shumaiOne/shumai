/**
 * | output |
 * | --- |
 * | "This action cannot be undone. This will permanently delete the project \"{name}\" and all its assets." |
 *
 * @param {Delete_Project_WarningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_project_warning: ((
  inputs: Delete_Project_WarningInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_Project_WarningInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_Project_WarningInputs = {
  name: NonNullable<unknown>
}
