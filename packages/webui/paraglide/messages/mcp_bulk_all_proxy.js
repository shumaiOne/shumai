/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Bulk_All_ProxyInputs */

const en_mcp_bulk_all_proxy = /** @type {(inputs: Mcp_Bulk_All_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Proxy`)
};

const zh_mcp_bulk_all_proxy = /** @type {(inputs: Mcp_Bulk_All_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全部代理`)
};

/**
* | output |
* | --- |
* | "All Proxy" |
*
* @param {Mcp_Bulk_All_ProxyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bulk_all_proxy = /** @type {((inputs?: Mcp_Bulk_All_ProxyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Bulk_All_ProxyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_bulk_all_proxy(inputs)
	return zh_mcp_bulk_all_proxy(inputs)
});