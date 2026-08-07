/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sample_BackdropInputs */

const en_sample_backdrop = /** @type {(inputs: Sample_BackdropInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sample Media`)
};

const zh_sample_backdrop = /** @type {(inputs: Sample_BackdropInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`示例媒体`)
};

/**
* | output |
* | --- |
* | "Sample Media" |
*
* @param {Sample_BackdropInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sample_backdrop = /** @type {((inputs?: Sample_BackdropInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sample_BackdropInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sample_backdrop(inputs)
	return zh_sample_backdrop(inputs)
});