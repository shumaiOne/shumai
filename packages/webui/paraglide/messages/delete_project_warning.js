/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Delete_Project_WarningInputs */

const en_delete_project_warning =
  /** @type {(inputs: Delete_Project_WarningInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (
      `This action cannot be undone. This will permanently delete the project "${i?.name}" and all its assets.`
    )
  }

const zh_delete_project_warning =
  /** @type {(inputs: Delete_Project_WarningInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (
      `此操作无法撤销。这将永久删除项目 "${i?.name}" 及其所有资产。`
    )
  }

/**
 * | output |
 * | --- |
 * | "This action cannot be undone. This will permanently delete the project \"{name}\" and all its assets." |
 *
 * @param {Delete_Project_WarningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_project_warning =
  /** @type {((inputs: Delete_Project_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Project_WarningInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_delete_project_warning(inputs)
      return zh_delete_project_warning(inputs)
    }
  )
