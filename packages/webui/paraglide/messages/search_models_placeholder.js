/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Models_PlaceholderInputs */

const en_search_models_placeholder = /** @type {(inputs: Search_Models_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search models by ID or name...`)
};

const zh_search_models_placeholder = /** @type {(inputs: Search_Models_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`按 ID 或名称搜索模型...`)
};

/**
* | output |
* | --- |
* | "Search models by ID or name..." |
*
* @param {Search_Models_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_models_placeholder = /** @type {((inputs?: Search_Models_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Models_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_models_placeholder(inputs)
	return zh_search_models_placeholder(inputs)
});