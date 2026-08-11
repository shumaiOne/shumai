/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Oauth_ScopeInputs */

const en_mcp_oauth_scope = /** @type {(inputs: Mcp_Oauth_ScopeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Scope`)
};

const zh_mcp_oauth_scope = /** @type {(inputs: Mcp_Oauth_ScopeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`作用域 (Scope)`)
};

/**
* | output |
* | --- |
* | "Scope" |
*
* @param {Mcp_Oauth_ScopeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_scope = /** @type {((inputs?: Mcp_Oauth_ScopeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Oauth_ScopeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_oauth_scope(inputs)
	return zh_mcp_oauth_scope(inputs)
});