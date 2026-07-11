/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} HistoryInputs */

const en_history = /** @type {(inputs: HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`History`)
};

const zh_history = /** @type {(inputs: HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`历史记录`)
};

/**
* | output |
* | --- |
* | "History" |
*
* @param {HistoryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const history = /** @type {((inputs?: HistoryInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<HistoryInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_history(inputs)
	return zh_history(inputs)
});