/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_Hint_ProxyInputs */

const en_mcp_tool_hint_proxy = /** @type {(inputs: Mcp_Tool_Hint_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Accessed through MCP proxy to keep LLM context small`)
};

const zh_mcp_tool_hint_proxy = /** @type {(inputs: Mcp_Tool_Hint_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`通过 MCP 代理调用，节省上下文占用`)
};

/**
* | output |
* | --- |
* | "Accessed through MCP proxy to keep LLM context small" |
*
* @param {Mcp_Tool_Hint_ProxyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_proxy = /** @type {((inputs?: Mcp_Tool_Hint_ProxyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_Hint_ProxyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_hint_proxy(inputs)
	return zh_mcp_tool_hint_proxy(inputs)
});