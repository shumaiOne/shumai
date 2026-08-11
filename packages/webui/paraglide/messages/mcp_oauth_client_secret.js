/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Oauth_Client_SecretInputs */

const en_mcp_oauth_client_secret = /** @type {(inputs: Mcp_Oauth_Client_SecretInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Client Secret`)
};

const zh_mcp_oauth_client_secret = /** @type {(inputs: Mcp_Oauth_Client_SecretInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Client Secret`)
};

/**
* | output |
* | --- |
* | "Client Secret" |
*
* @param {Mcp_Oauth_Client_SecretInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_client_secret = /** @type {((inputs?: Mcp_Oauth_Client_SecretInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Oauth_Client_SecretInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_oauth_client_secret(inputs)
	return zh_mcp_oauth_client_secret(inputs)
});