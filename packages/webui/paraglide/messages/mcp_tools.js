/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_ToolsInputs */

const en_mcp_tools = /** @type {(inputs: Mcp_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP Tools`)
};

const zh_mcp_tools = /** @type {(inputs: Mcp_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 工具`)
};

/**
* | output |
* | --- |
* | "MCP Tools" |
*
* @param {Mcp_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tools = /** @type {((inputs?: Mcp_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tools(inputs)
	return zh_mcp_tools(inputs)
});