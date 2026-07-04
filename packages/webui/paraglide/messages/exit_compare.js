/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Exit_CompareInputs */

const en_exit_compare = /** @type {(inputs: Exit_CompareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Exit compare`)
};

const zh_exit_compare = /** @type {(inputs: Exit_CompareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`退出对比`)
};

/**
* | output |
* | --- |
* | "Exit compare" |
*
* @param {Exit_CompareInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const exit_compare = /** @type {((inputs?: Exit_CompareInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Exit_CompareInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_exit_compare(inputs)
	return zh_exit_compare(inputs)
});