/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mark_As_IncompleteInputs */

const en_mark_as_incomplete = /** @type {(inputs: Mark_As_IncompleteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Mark as incomplete`)
};

const zh_mark_as_incomplete = /** @type {(inputs: Mark_As_IncompleteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`标记为未完成`)
};

/**
* | output |
* | --- |
* | "Mark as incomplete" |
*
* @param {Mark_As_IncompleteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mark_as_incomplete = /** @type {((inputs?: Mark_As_IncompleteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mark_As_IncompleteInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mark_as_incomplete(inputs)
	return zh_mark_as_incomplete(inputs)
});