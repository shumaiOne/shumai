/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Refresh_ServerInputs */

const en_mcp_refresh_server = /** @type {(inputs: Mcp_Refresh_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Refresh Server`)
};

const zh_mcp_refresh_server = /** @type {(inputs: Mcp_Refresh_ServerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`刷新服务器`)
};

/**
* | output |
* | --- |
* | "Refresh Server" |
*
* @param {Mcp_Refresh_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_refresh_server = /** @type {((inputs?: Mcp_Refresh_ServerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Refresh_ServerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_refresh_server(inputs)
	return zh_mcp_refresh_server(inputs)
});