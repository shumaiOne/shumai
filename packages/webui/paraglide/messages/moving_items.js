/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Moving_ItemsInputs */

const en_moving_items = /** @type {(inputs: Moving_ItemsInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Moving ${i?.count} item(s)`)
}

const zh_moving_items = /** @type {(inputs: Moving_ItemsInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`正在移动 ${i?.count} 个项目`)
}

/**
 * | output |
 * | --- |
 * | "Moving {count} item(s)" |
 *
 * @param {Moving_ItemsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const moving_items =
  /** @type {((inputs: Moving_ItemsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Moving_ItemsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_moving_items(inputs)
      return zh_moving_items(inputs)
    }
  )
