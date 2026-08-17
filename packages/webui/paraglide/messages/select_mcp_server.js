/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Mcp_ServerInputs */

const en_select_mcp_server = /** @type {(inputs: Select_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select MCP Server`)
};

const zh_select_mcp_server = /** @type {(inputs: Select_Mcp_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择 MCP 服务`)
};

/**
* | output |
* | --- |
* | "Select MCP Server" |
*
* @param {Select_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_mcp_server = /** @type {((inputs?: Select_Mcp_ServerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Mcp_ServerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_mcp_server(inputs)
	return zh_select_mcp_server(inputs)
});