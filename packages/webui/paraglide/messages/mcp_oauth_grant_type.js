/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Oauth_Grant_TypeInputs */

const en_mcp_oauth_grant_type = /** @type {(inputs: Mcp_Oauth_Grant_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grant Type`)
};

const zh_mcp_oauth_grant_type = /** @type {(inputs: Mcp_Oauth_Grant_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`授权模式 (Grant Type)`)
};

/**
* | output |
* | --- |
* | "Grant Type" |
*
* @param {Mcp_Oauth_Grant_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_grant_type = /** @type {((inputs?: Mcp_Oauth_Grant_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Oauth_Grant_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_oauth_grant_type(inputs)
	return zh_mcp_oauth_grant_type(inputs)
});