/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_OauthInputs */

const en_mcp_auth_oauth = /** @type {(inputs: Mcp_Auth_OauthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`OAuth 2.0`)
};

const zh_mcp_auth_oauth = /** @type {(inputs: Mcp_Auth_OauthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`OAuth 2.0`)
};

/**
* | output |
* | --- |
* | "OAuth 2.0" |
*
* @param {Mcp_Auth_OauthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_oauth = /** @type {((inputs?: Mcp_Auth_OauthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_OauthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_oauth(inputs)
	return zh_mcp_auth_oauth(inputs)
});