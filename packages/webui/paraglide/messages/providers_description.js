/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Providers_DescriptionInputs */

const en_providers_description = /** @type {(inputs: Providers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure AI providers and their models for this team.`)
};

const zh_providers_description = /** @type {(inputs: Providers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为此团队配置 AI 提供商及其模型。`)
};

/**
* | output |
* | --- |
* | "Configure AI providers and their models for this team." |
*
* @param {Providers_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const providers_description = /** @type {((inputs?: Providers_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Providers_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_providers_description(inputs)
	return zh_providers_description(inputs)
});