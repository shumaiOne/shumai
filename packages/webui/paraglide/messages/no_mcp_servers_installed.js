/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Mcp_Servers_InstalledInputs */

const en_no_mcp_servers_installed = /** @type {(inputs: No_Mcp_Servers_InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No MCP servers configured`)
};

const zh_no_mcp_servers_installed = /** @type {(inputs: No_Mcp_Servers_InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂未配置 MCP 服务`)
};

/**
* | output |
* | --- |
* | "No MCP servers configured" |
*
* @param {No_Mcp_Servers_InstalledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_mcp_servers_installed = /** @type {((inputs?: No_Mcp_Servers_InstalledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Mcp_Servers_InstalledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_mcp_servers_installed(inputs)
	return zh_no_mcp_servers_installed(inputs)
});