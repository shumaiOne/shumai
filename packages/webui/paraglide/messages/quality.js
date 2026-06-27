/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} QualityInputs */

const en_quality = /** @type {(inputs: QualityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quality`)
};

const zh_quality = /** @type {(inputs: QualityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`画质`)
};

/**
* | output |
* | --- |
* | "Quality" |
*
* @param {QualityInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quality = /** @type {((inputs?: QualityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<QualityInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quality(inputs)
	return zh_quality(inputs)
});