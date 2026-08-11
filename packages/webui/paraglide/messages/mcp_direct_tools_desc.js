/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Direct_Tools_DescInputs */

const en_mcp_direct_tools_desc = /** @type {(inputs: Mcp_Direct_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Exposes MCP tools as native agent tools instead of hiding them behind the MCP proxy. This lets the agent see and call selected MCP tools directly, improving tool discovery and reducing unnecessary searches. Use it for frequently used or important tools; keep large MCP servers behind the proxy to avoid increasing context usage.`)
};

const zh_mcp_direct_tools_desc = /** @type {(inputs: Mcp_Direct_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`将 MCP 工具直接作为智能体原生工具暴露，而非隐匿在 MCP 代理之后。这使得智能体能直接感知并调用选定的 MCP 工具，提高工具发现率并减少不必要的搜索。建议对于高频或关键工具开启此模式；大型 MCP 服务建议保持代理模式以避免增加上下文消耗。`)
};

/**
* | output |
* | --- |
* | "Exposes MCP tools as native agent tools instead of hiding them behind the MCP proxy. This lets the agent see and call selected MCP tools directly, improving ..." |
*
* @param {Mcp_Direct_Tools_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_desc = /** @type {((inputs?: Mcp_Direct_Tools_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Direct_Tools_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_direct_tools_desc(inputs)
	return zh_mcp_direct_tools_desc(inputs)
});