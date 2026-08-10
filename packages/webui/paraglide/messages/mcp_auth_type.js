/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_TypeInputs */

const en_mcp_auth_type = /** @type {(inputs: Mcp_Auth_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Authentication Type`)
};

const zh_mcp_auth_type = /** @type {(inputs: Mcp_Auth_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`身份验证类型`)
};

/**
* | output |
* | --- |
* | "Authentication Type" |
*
* @param {Mcp_Auth_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_type = /** @type {((inputs?: Mcp_Auth_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_type(inputs)
	return zh_mcp_auth_type(inputs)
});