/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_Mcp_ServerInputs */

const en_edit_mcp_server = /** @type {(inputs: Edit_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit MCP Server`)
};

const zh_edit_mcp_server = /** @type {(inputs: Edit_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`编辑 MCP 服务`)
};

/**
* | output |
* | --- |
* | "Edit MCP Server" |
*
* @param {Edit_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_mcp_server = /** @type {((inputs?: Edit_Mcp_ServerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_Mcp_ServerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_mcp_server(inputs)
	return zh_edit_mcp_server(inputs)
});