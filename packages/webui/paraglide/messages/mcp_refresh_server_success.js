/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Refresh_Server_SuccessInputs */

const en_mcp_refresh_server_success = /** @type {(inputs: Mcp_Refresh_Server_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Server refreshed`)
};

const zh_mcp_refresh_server_success = /** @type {(inputs: Mcp_Refresh_Server_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`服务器已刷新`)
};

/**
* | output |
* | --- |
* | "Server refreshed" |
*
* @param {Mcp_Refresh_Server_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_refresh_server_success = /** @type {((inputs?: Mcp_Refresh_Server_SuccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Refresh_Server_SuccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_refresh_server_success(inputs)
	return zh_mcp_refresh_server_success(inputs)
});