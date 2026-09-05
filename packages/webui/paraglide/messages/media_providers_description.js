/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Providers_DescriptionInputs */

const en_media_providers_description = /** @type {(inputs: Media_Providers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure API keys for built-in media generation providers. Providers can use environment variables or custom keys.`)
};

const zh_media_providers_description = /** @type {(inputs: Media_Providers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为内置媒体生成提供商配置 API 密钥。提供商可以使用环境变量或自定义密钥。`)
};

/**
* | output |
* | --- |
* | "Configure API keys for built-in media generation providers. Providers can use environment variables or custom keys." |
*
* @param {Media_Providers_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_providers_description = /** @type {((inputs?: Media_Providers_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Providers_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_providers_description(inputs)
	return zh_media_providers_description(inputs)
});