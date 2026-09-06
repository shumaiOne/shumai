/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Provider_FirstInputs */

const en_select_provider_first = /** @type {(inputs: Select_Provider_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select a provider on the left to view available models`)
};

const zh_select_provider_first = /** @type {(inputs: Select_Provider_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请先在左侧选择一个提供商以查看可用模型`)
};

/**
* | output |
* | --- |
* | "Select a provider on the left to view available models" |
*
* @param {Select_Provider_FirstInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_provider_first = /** @type {((inputs?: Select_Provider_FirstInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Provider_FirstInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_provider_first(inputs)
	return zh_select_provider_first(inputs)
});