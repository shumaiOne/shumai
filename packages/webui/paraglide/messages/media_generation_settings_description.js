/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Generation_Settings_DescriptionInputs */

const en_media_generation_settings_description = /** @type {(inputs: Media_Generation_Settings_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure providers and enabled models for built-in image and video generation tools.`)
};

const zh_media_generation_settings_description = /** @type {(inputs: Media_Generation_Settings_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置内置图像和视频生成工具的提供商与已启用模型。`)
};

/**
* | output |
* | --- |
* | "Configure providers and enabled models for built-in image and video generation tools." |
*
* @param {Media_Generation_Settings_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_generation_settings_description = /** @type {((inputs?: Media_Generation_Settings_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Generation_Settings_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_generation_settings_description(inputs)
	return zh_media_generation_settings_description(inputs)
});