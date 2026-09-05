/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Enabled_ModelsInputs */

const en_no_enabled_models = /** @type {(inputs: No_Enabled_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No media generation models enabled yet. Add at least one image or video model to enable the generation tools.`)
};

const zh_no_enabled_models = /** @type {(inputs: No_Enabled_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`尚未启用任何媒体生成模型。添加至少一个图像或视频模型以启用生成工具。`)
};

/**
* | output |
* | --- |
* | "No media generation models enabled yet. Add at least one image or video model to enable the generation tools." |
*
* @param {No_Enabled_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_enabled_models = /** @type {((inputs?: No_Enabled_ModelsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Enabled_ModelsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_enabled_models(inputs)
	return zh_no_enabled_models(inputs)
});