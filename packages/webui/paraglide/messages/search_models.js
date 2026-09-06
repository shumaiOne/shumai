/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_ModelsInputs */

const en_search_models = /** @type {(inputs: Search_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search models...`)
};

const zh_search_models = /** @type {(inputs: Search_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索模型...`)
};

/**
* | output |
* | --- |
* | "Search models..." |
*
* @param {Search_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_models = /** @type {((inputs?: Search_ModelsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_ModelsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_models(inputs)
	return zh_search_models(inputs)
});