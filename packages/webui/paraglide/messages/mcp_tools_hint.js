/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tools_HintInputs */

const en_mcp_tools_hint = /** @type {(inputs: Mcp_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure tools as Off (disabled), Proxy (via MCP proxy), or Direct (native tool).`)
};

const zh_mcp_tools_hint = /** @type {(inputs: Mcp_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`将工具配置为关闭（禁用）、代理（通过 mcp 代理调用）或直连（直接暴露给 Agent）。`)
};

/**
* | output |
* | --- |
* | "Configure tools as Off (disabled), Proxy (via MCP proxy), or Direct (native tool)." |
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