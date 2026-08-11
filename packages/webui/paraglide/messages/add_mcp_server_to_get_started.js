/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Mcp_Server_To_Get_StartedInputs */

const en_add_mcp_server_to_get_started = /** @type {(inputs: Add_Mcp_Server_To_Get_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add an MCP server to extend your AI agent tools.`)
};

const zh_add_mcp_server_to_get_started = /** @type {(inputs: Add_Mcp_Server_To_Get_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加 MCP 服务以扩展 AI Agent 的工具能力。`)
};

/**
* | output |
* | --- |
* | "Add an MCP server to extend your AI agent tools." |
*
* @param {Add_Mcp_Server_To_Get_StartedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_mcp_server_to_get_started = /** @type {((inputs?: Add_Mcp_Server_To_Get_StartedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Mcp_Server_To_Get_StartedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_mcp_server_to_get_started(inputs)
	return zh_add_mcp_server_to_get_started(inputs)
});