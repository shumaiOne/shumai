/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_UsageInputs */

const en_ai_usage = /** @type {(inputs: Ai_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Token Usage`)
};

const zh_ai_usage = /** @type {(inputs: Ai_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Token 用量`)
};

/**
* | output |
* | --- |
* | "AI Token Usage" |
*
* @param {Ai_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_usage = /** @type {((inputs?: Ai_UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_usage(inputs)
	return zh_ai_usage(inputs)
});