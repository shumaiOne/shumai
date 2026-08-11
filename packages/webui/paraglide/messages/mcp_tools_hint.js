/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tools_HintInputs */

const en_mcp_tools_hint = /** @type {(inputs: Mcp_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Off: Disabled. Proxy: Tools are accessed through the MCP proxy to keep LLM context small. Direct: Exposes tools directly as native agent tools for key or frequently used capabilities to improve tool discovery.`)
};

const zh_mcp_tools_hint = /** @type {(inputs: Mcp_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关闭：禁用该工具。代理：通过 MCP 代理调用，节省上下文消耗。直连：直接暴露为智能体原生工具，便于高频/关键工具快速感知与调用。`)
};

/**
* | output |
* | --- |
* | "Off: Disabled. Proxy: Tools are accessed through the MCP proxy to keep LLM context small. Direct: Exposes tools directly as native agent tools for key or fre..." |
*
* @param {Mcp_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tools_hint = /** @type {((inputs?: Mcp_Tools_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tools_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tools_hint(inputs)
	return zh_mcp_tools_hint(inputs)
});