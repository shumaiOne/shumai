/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} View_ToolsInputs */

const en_view_tools = /** @type {(inputs: View_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View Tools`)
};

const zh_view_tools = /** @type {(inputs: View_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看工具`)
};

/**
* | output |
* | --- |
* | "View Tools" |
*
* @param {View_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const view_tools = /** @type {((inputs?: View_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<View_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_view_tools(inputs)
	return zh_view_tools(inputs)
});