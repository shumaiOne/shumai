/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enabled_Media_Models_DescriptionInputs */

const en_enabled_media_models_description = /** @type {(inputs: Enabled_Media_Models_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Models enabled for the generate_image and generate_video tools. The first model of each type serves as default.`)
};

const zh_enabled_media_models_description = /** @type {(inputs: Enabled_Media_Models_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`供 generate_image 和 generate_video 工具使用的已启用模型。每种类型的第一个模型将作为默认模型。`)
};

/**
* | output |
* | --- |
* | "Models enabled for the generate_image and generate_video tools. The first model of each type serves as default." |
*
* @param {Enabled_Media_Models_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enabled_media_models_description = /** @type {((inputs?: Enabled_Media_Models_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enabled_Media_Models_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enabled_media_models_description(inputs)
	return zh_enabled_media_models_description(inputs)
});