/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GeneratingInputs */

const en_generating = /** @type {(inputs: GeneratingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Generating...`)
};

const zh_generating = /** @type {(inputs: GeneratingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在生成...`)
};

/**
* | output |
* | --- |
* | "Generating..." |
*
* @param {GeneratingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const generating = /** @type {((inputs?: GeneratingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GeneratingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_generating(inputs)
	return zh_generating(inputs)
});