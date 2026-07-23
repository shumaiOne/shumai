/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UsageInputs */

const en_usage = /** @type {(inputs: UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Usage`)
};

const zh_usage = /** @type {(inputs: UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`用量`)
};

/**
* | output |
* | --- |
* | "Usage" |
*
* @param {UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const usage = /** @type {((inputs?: UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_usage(inputs)
	return zh_usage(inputs)
});