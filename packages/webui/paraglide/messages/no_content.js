/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_ContentInputs */

const en_no_content = /** @type {(inputs: No_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No content.`)
};

const zh_no_content = /** @type {(inputs: No_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无内容。`)
};

/**
* | output |
* | --- |
* | "No content." |
*
* @param {No_ContentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_content = /** @type {((inputs?: No_ContentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_ContentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_content(inputs)
	return zh_no_content(inputs)
});