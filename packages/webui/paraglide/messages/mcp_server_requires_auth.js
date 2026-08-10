/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Server_Requires_AuthInputs */

const en_mcp_server_requires_auth = /** @type {(inputs: Mcp_Server_Requires_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This MCP server requires authentication. Connect in Settings → MCP Servers.`)
};

const zh_mcp_server_requires_auth = /** @type {(inputs: Mcp_Server_Requires_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`该 MCP 服务需要身份验证，请前往 设置 → MCP 服务 进行连接。`)
};

/**
* | output |
* | --- |
* | "This MCP server requires authentication. Connect in Settings → MCP Servers." |
*
* @param {Mcp_Server_Requires_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_requires_auth = /** @type {((inputs?: Mcp_Server_Requires_AuthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Server_Requires_AuthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_server_requires_auth(inputs)
	return zh_mcp_server_requires_auth(inputs)
});