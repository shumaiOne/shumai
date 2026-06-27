/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} List_ViewInputs */

const en_list_view = /** @type {(inputs: List_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`List View`)
};

const zh_list_view = /** @type {(inputs: List_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`列表视图`)
};

/**
* | output |
* | --- |
* | "List View" |
*
* @param {List_ViewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const list_view = /** @type {((inputs?: List_ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<List_ViewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_list_view(inputs)
	return zh_list_view(inputs)
});