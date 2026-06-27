/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_ProvidersInputs */

const en_ai_providers = /** @type {(inputs: Ai_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Providers`)
};

const zh_ai_providers = /** @type {(inputs: Ai_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 提供商`)
};

/**
* | output |
* | --- |
* | "AI Providers" |
*
* @param {Ai_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_providers = /** @type {((inputs?: Ai_ProvidersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_ProvidersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_providers(inputs)
	return zh_ai_providers(inputs)
});