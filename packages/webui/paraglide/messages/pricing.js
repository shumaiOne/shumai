/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} PricingInputs */

const en_pricing = /** @type {(inputs: PricingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pricing ($ per 1M tokens)`)
};

const zh_pricing = /** @type {(inputs: PricingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`计费（每百万令牌美元）`)
};

/**
* | output |
* | --- |
* | "Pricing ($ per 1M tokens)" |
*
* @param {PricingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const pricing = /** @type {((inputs?: PricingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<PricingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_pricing(inputs)
	return zh_pricing(inputs)
});