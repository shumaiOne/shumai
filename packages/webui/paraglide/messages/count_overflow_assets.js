/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Count_Overflow_AssetsInputs */

const en_count_overflow_assets = /** @type {(inputs: Count_Overflow_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`10000+ Assets`)
};

const zh_count_overflow_assets = /** @type {(inputs: Count_Overflow_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`10000+ 资源`)
};

/**
* | output |
* | --- |
* | "10000+ Assets" |
*
* @param {Count_Overflow_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const count_overflow_assets = /** @type {((inputs?: Count_Overflow_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Count_Overflow_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_count_overflow_assets(inputs)
	return zh_count_overflow_assets(inputs)
});