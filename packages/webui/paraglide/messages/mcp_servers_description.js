/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Servers_DescriptionInputs */

const en_mcp_servers_description = /** @type {(inputs: Mcp_Servers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure Model Context Protocol (MCP) servers and tools for your team.`)
};

const zh_mcp_servers_description = /** @type {(inputs: Mcp_Servers_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为团队配置 Model Context Protocol (MCP) 服务与工具。`)
};

/**
* | output |
* | --- |
* | "Configure Model Context Protocol (MCP) servers and tools for your team." |
*
* @param {Mcp_Servers_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_servers_description = /** @type {((inputs?: Mcp_Servers_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Servers_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_servers_description(inputs)
	return zh_mcp_servers_description(inputs)
});