/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Oauth_Client_IdInputs */

const en_mcp_oauth_client_id = /** @type {(inputs: Mcp_Oauth_Client_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Client ID`)
};

const zh_mcp_oauth_client_id = /** @type {(inputs: Mcp_Oauth_Client_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Client ID`)
};

/**
* | output |
* | --- |
* | "Client ID" |
*
* @param {Mcp_Oauth_Client_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_client_id = /** @type {((inputs?: Mcp_Oauth_Client_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Oauth_Client_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_oauth_client_id(inputs)
	return zh_mcp_oauth_client_id(inputs)
});