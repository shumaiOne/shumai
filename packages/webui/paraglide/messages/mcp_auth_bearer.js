/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_BearerInputs */

const en_mcp_auth_bearer = /** @type {(inputs: Mcp_Auth_BearerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bearer Token`)
};

const zh_mcp_auth_bearer = /** @type {(inputs: Mcp_Auth_BearerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bearer 令牌`)
};

/**
* | output |
* | --- |
* | "Bearer Token" |
*
* @param {Mcp_Auth_BearerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_bearer = /** @type {((inputs?: Mcp_Auth_BearerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_BearerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_bearer(inputs)
	return zh_mcp_auth_bearer(inputs)
});