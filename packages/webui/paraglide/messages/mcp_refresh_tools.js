/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Refresh_ToolsInputs */

const en_mcp_refresh_tools = /** @type {(inputs: Mcp_Refresh_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Refresh Tools`)
};

const zh_mcp_refresh_tools = /** @type {(inputs: Mcp_Refresh_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`刷新工具列表`)
};

/**
* | output |
* | --- |
* | "Refresh Tools" |
*
* @param {Mcp_Refresh_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_refresh_tools = /** @type {((inputs?: Mcp_Refresh_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Refresh_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_refresh_tools(inputs)
	return zh_mcp_refresh_tools(inputs)
});