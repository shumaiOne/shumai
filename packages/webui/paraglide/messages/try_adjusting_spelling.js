/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Try_Adjusting_SpellingInputs */

const en_try_adjusting_spelling = /** @type {(inputs: Try_Adjusting_SpellingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try adjusting spelling or removing filter rows.`)
};

const zh_try_adjusting_spelling = /** @type {(inputs: Try_Adjusting_SpellingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请尝试调整拼写或移除筛选条件。`)
};

/**
* | output |
* | --- |
* | "Try adjusting spelling or removing filter rows." |
*
* @param {Try_Adjusting_SpellingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const try_adjusting_spelling = /** @type {((inputs?: Try_Adjusting_SpellingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Try_Adjusting_SpellingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_try_adjusting_spelling(inputs)
	return zh_try_adjusting_spelling(inputs)
});