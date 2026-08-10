/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Included_ToolsInputs */

const en_included_tools = /** @type {(inputs: Included_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Included Tools`)
};

const zh_included_tools = /** @type {(inputs: Included_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`包含的工具`)
};

/**
* | output |
* | --- |
* | "Included Tools" |
*
* @param {Included_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const included_tools = /** @type {((inputs?: Included_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Included_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_included_tools(inputs)
	return zh_included_tools(inputs)
});