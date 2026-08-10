/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Disconnect_AuthInputs */

const en_mcp_disconnect_auth = /** @type {(inputs: Mcp_Disconnect_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disconnect Auth`)
};

const zh_mcp_disconnect_auth = /** @type {(inputs: Mcp_Disconnect_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`断开身份验证`)
};

/**
* | output |
* | --- |
* | "Disconnect Auth" |
*
* @param {Mcp_Disconnect_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_disconnect_auth = /** @type {((inputs?: Mcp_Disconnect_AuthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Disconnect_AuthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_disconnect_auth(inputs)
	return zh_mcp_disconnect_auth(inputs)
});