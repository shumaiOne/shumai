/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Semantic_Search_NoteInputs */

const en_semantic_search_note =
  /** @type {(inputs: Semantic_Search_NoteInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Semantic search results will be ordered by their relevance to the search query text, but won't be strictly filtered. If you need accurate filtering, please add filter conditions to control that.`
    )
  }

const zh_semantic_search_note =
  /** @type {(inputs: Semantic_Search_NoteInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `语义搜索结果将按与搜索查询文本的相关性排序，但不会严格筛选。如果需要精确筛选，请添加筛选条件来控制。`
    )
  }

/**
 * | output |
 * | --- |
 * | "Semantic search results will be ordered by their relevance to the search query text, but won't be strictly filtered. If you need accurate filtering, please a..." |
 *
 * @param {Semantic_Search_NoteInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const semantic_search_note =
  /** @type {((inputs?: Semantic_Search_NoteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semantic_Search_NoteInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_semantic_search_note(inputs)
      return zh_semantic_search_note(inputs)
    }
  )
