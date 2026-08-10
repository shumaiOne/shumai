/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Server_NameInputs */

const en_mcp_server_name = /** @type {(inputs: Mcp_Server_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Server Name`)
};

const zh_mcp_server_name = /** @type {(inputs: Mcp_Server_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`服务名称`)
};

/**
* | output |
* | --- |
* | "Server Name" |
*
* @param {Mcp_Server_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_name = /** @type {((inputs?: Mcp_Server_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Server_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_server_name(inputs)
	return zh_mcp_server_name(inputs)
});