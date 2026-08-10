/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_ServersInputs */

const en_mcp_servers = /** @type {(inputs: Mcp_ServersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP Servers`)
};

const zh_mcp_servers = /** @type {(inputs: Mcp_ServersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 服务`)
};

/**
* | output |
* | --- |
* | "MCP Servers" |
*
* @param {Mcp_ServersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_servers = /** @type {((inputs?: Mcp_ServersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_ServersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_servers(inputs)
	return zh_mcp_servers(inputs)
});