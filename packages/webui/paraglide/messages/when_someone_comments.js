/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Someone_CommentsInputs */

const en_when_someone_comments =
  /** @type {(inputs: When_Someone_CommentsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`When someone comments on an asset`)
  }

const zh_when_someone_comments =
  /** @type {(inputs: When_Someone_CommentsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`当有人评论素材时`)
  }

/**
 * | output |
 * | --- |
 * | "When someone comments on an asset" |
 *
 * @param {When_Someone_CommentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_someone_comments =
  /** @type {((inputs?: When_Someone_CommentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Someone_CommentsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_when_someone_comments(inputs)
      return zh_when_someone_comments(inputs)
    }
  )
