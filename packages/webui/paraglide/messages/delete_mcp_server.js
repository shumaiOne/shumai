/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Mcp_ServerInputs */

const en_delete_mcp_server = /** @type {(inputs: Delete_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete MCP Server`)
};

const zh_delete_mcp_server = /** @type {(inputs: Delete_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除 MCP 服务`)
};

/**
* | output |
* | --- |
* | "Delete MCP Server" |
*
* @param {Delete_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_mcp_server = /** @type {((inputs?: Delete_Mcp_ServerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Mcp_ServerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_mcp_server(inputs)
	return zh_delete_mcp_server(inputs)
});