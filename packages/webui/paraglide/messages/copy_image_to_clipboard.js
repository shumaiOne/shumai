/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_Image_To_ClipboardInputs */

const en_copy_image_to_clipboard =
  /** @type {(inputs: Copy_Image_To_ClipboardInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Copy optimized image to clipboard`)
  }

const zh_copy_image_to_clipboard =
  /** @type {(inputs: Copy_Image_To_ClipboardInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`复制优化图片到剪贴板`)
  }

/**
 * | output |
 * | --- |
 * | "Copy optimized image to clipboard" |
 *
 * @param {Copy_Image_To_ClipboardInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copy_image_to_clipboard =
  /** @type {((inputs?: Copy_Image_To_ClipboardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_Image_To_ClipboardInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_copy_image_to_clipboard(inputs)
      return zh_copy_image_to_clipboard(inputs)
    }
  )
