/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Server_UrlInputs */

const en_mcp_server_url = /** @type {(inputs: Mcp_Server_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Endpoint URL`)
};

const zh_mcp_server_url = /** @type {(inputs: Mcp_Server_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Endpoint URL`)
};

/**
* | output |
* | --- |
* | "Endpoint URL" |
*
* @param {Mcp_Server_UrlInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_url = /** @type {((inputs?: Mcp_Server_UrlInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Server_UrlInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_server_url(inputs)
	return zh_mcp_server_url(inputs)
});