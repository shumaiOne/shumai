/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_SuccessInputs */

const en_mcp_auth_success = /** @type {(inputs: Mcp_Auth_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP server authenticated successfully`)
};

const zh_mcp_auth_success = /** @type {(inputs: Mcp_Auth_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 服务身份验证成功`)
};

/**
* | output |
* | --- |
* | "MCP server authenticated successfully" |
*
* @param {Mcp_Auth_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_success = /** @type {((inputs?: Mcp_Auth_SuccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_SuccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_success(inputs)
	return zh_mcp_auth_success(inputs)
});