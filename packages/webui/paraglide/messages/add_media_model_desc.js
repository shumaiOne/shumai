/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Media_Model_DescInputs */

const en_add_media_model_desc = /** @type {(inputs: Add_Media_Model_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select the media generation type, provider, and model to enable.`)
};

const zh_add_media_model_desc = /** @type {(inputs: Add_Media_Model_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择要启用的媒体生成类型、提供商和模型。`)
};

/**
* | output |
* | --- |
* | "Select the media generation type, provider, and model to enable." |
*
* @param {Add_Media_Model_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_media_model_desc = /** @type {((inputs?: Add_Media_Model_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Media_Model_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_media_model_desc(inputs)
	return zh_add_media_model_desc(inputs)
});