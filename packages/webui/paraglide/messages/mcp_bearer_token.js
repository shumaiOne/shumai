/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Bearer_TokenInputs */

const en_mcp_bearer_token = /** @type {(inputs: Mcp_Bearer_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bearer Token`)
};

const zh_mcp_bearer_token = /** @type {(inputs: Mcp_Bearer_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bearer 令牌`)
};

/**
* | output |
* | --- |
* | "Bearer Token" |
*
* @param {Mcp_Bearer_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bearer_token = /** @type {((inputs?: Mcp_Bearer_TokenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Bearer_TokenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_bearer_token(inputs)
	return zh_mcp_bearer_token(inputs)
});