/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tools_DescInputs */

const en_mcp_tools_desc = /** @type {(inputs: Mcp_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure how MCP tools are exposed to the agent. Proxy mode keeps context usage low by hiding tools behind an MCP proxy, while Direct mode exposes selected tools as native agent tools for better discovery and faster access. Use Direct mode for frequently used or critical tools, and keep large MCP servers behind the proxy to avoid unnecessary context overhead.`)
};

const zh_mcp_tools_desc = /** @type {(inputs: Mcp_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置 MCP 工具向 Agent 的暴露方式。代理模式通过 MCP 代理隐匿工具，以保持较低的上下文占用；直连模式将选定工具直接作为 Agent 原生工具暴露，便于更好地发现与更快地调用。建议对高频或关键工具使用直连模式，对于大型 MCP 服务保持代理模式以避免不必要的上下文开销。`)
};

/**
* | output |
* | --- |
* | "Configure how MCP tools are exposed to the agent. Proxy mode keeps context usage low by hiding tools behind an MCP proxy, while Direct mode exposes selected ..." |
*
* @param {Mcp_Tools_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tools_desc = /** @type {((inputs?: Mcp_Tools_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tools_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tools_desc(inputs)
	return zh_mcp_tools_desc(inputs)
});