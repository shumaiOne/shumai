/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loading_ModelsInputs */

const en_loading_models = /** @type {(inputs: Loading_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading models...`)
};

const zh_loading_models = /** @type {(inputs: Loading_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在加载模型...`)
};

/**
* | output |
* | --- |
* | "Loading models..." |
*
* @param {Loading_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const loading_models = /** @type {((inputs?: Loading_ModelsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loading_ModelsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_loading_models(inputs)
	return zh_loading_models(inputs)
});