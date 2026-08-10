/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Status_Needs_AuthInputs */

const en_mcp_status_needs_auth = /** @type {(inputs: Mcp_Status_Needs_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Needs Authentication`)
};

const zh_mcp_status_needs_auth = /** @type {(inputs: Mcp_Status_Needs_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`需要身份验证`)
};

/**
* | output |
* | --- |
* | "Needs Authentication" |
*
* @param {Mcp_Status_Needs_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_status_needs_auth = /** @type {((inputs?: Mcp_Status_Needs_AuthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Status_Needs_AuthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_status_needs_auth(inputs)
	return zh_mcp_status_needs_auth(inputs)
});