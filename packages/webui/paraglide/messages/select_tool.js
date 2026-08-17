/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_ToolInputs */

const en_select_tool = /** @type {(inputs: Select_ToolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Tool`)
};

const zh_select_tool = /** @type {(inputs: Select_ToolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择工具`)
};

/**
* | output |
* | --- |
* | "Select Tool" |
*
* @param {Select_ToolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_tool = /** @type {((inputs?: Select_ToolInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_ToolInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_tool(inputs)
	return zh_select_tool(inputs)
});