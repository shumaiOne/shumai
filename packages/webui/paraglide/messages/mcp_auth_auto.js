/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Auth_AutoInputs */

const en_mcp_auth_auto = /** @type {(inputs: Mcp_Auth_AutoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Auto-Detect (Default)`)
};

const zh_mcp_auth_auto = /** @type {(inputs: Mcp_Auth_AutoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自动检测 (默认)`)
};

/**
* | output |
* | --- |
* | "Auto-Detect (Default)" |
*
* @param {Mcp_Auth_AutoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_auto = /** @type {((inputs?: Mcp_Auth_AutoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Auth_AutoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_auth_auto(inputs)
	return zh_mcp_auth_auto(inputs)
});