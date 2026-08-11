/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_Hint_OffInputs */

const en_mcp_tool_hint_off = /** @type {(inputs: Mcp_Tool_Hint_OffInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disabled`)
};

const zh_mcp_tool_hint_off = /** @type {(inputs: Mcp_Tool_Hint_OffInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`禁用该工具`)
};

/**
* | output |
* | --- |
* | "Disabled" |
*
* @param {Mcp_Tool_Hint_OffInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_off = /** @type {((inputs?: Mcp_Tool_Hint_OffInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_Hint_OffInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_hint_off(inputs)
	return zh_mcp_tool_hint_off(inputs)
});