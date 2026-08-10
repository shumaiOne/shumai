/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Excluded_ToolsInputs */

const en_excluded_tools = /** @type {(inputs: Excluded_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Excluded Tools`)
};

const zh_excluded_tools = /** @type {(inputs: Excluded_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`排除的工具`)
};

/**
* | output |
* | --- |
* | "Excluded Tools" |
*
* @param {Excluded_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const excluded_tools = /** @type {((inputs?: Excluded_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Excluded_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_excluded_tools(inputs)
	return zh_excluded_tools(inputs)
});