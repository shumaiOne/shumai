/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Generating_EmbeddingsInputs */

const en_generating_embeddings =
  /** @type {(inputs: Generating_EmbeddingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Generating embeddings...`)
  }

const zh_generating_embeddings =
  /** @type {(inputs: Generating_EmbeddingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`正在生成嵌入...`)
  }

/**
 * | output |
 * | --- |
 * | "Generating embeddings..." |
 *
 * @param {Generating_EmbeddingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const generating_embeddings =
  /** @type {((inputs?: Generating_EmbeddingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Generating_EmbeddingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_generating_embeddings(inputs)
      return zh_generating_embeddings(inputs)
    }
  )
