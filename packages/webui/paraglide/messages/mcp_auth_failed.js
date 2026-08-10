/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_FailedInputs */

const en_mcp_auth_failed = /** @type {(inputs: Mcp_Auth_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to authenticate MCP server`)
};

const zh_mcp_auth_failed = /** @type {(inputs: Mcp_Auth_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 服务身份验证失败`)
};

/**
* | output |
* | --- |
* | "Failed to authenticate MCP server" |
*
* @param {Mcp_Auth_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_failed = /** @type {((inputs?: Mcp_Auth_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_FailedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_failed(inputs)
	return zh_mcp_auth_failed(inputs)
});