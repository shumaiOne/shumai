/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Bulk_All_DirectInputs */

const en_mcp_bulk_all_direct = /** @type {(inputs: Mcp_Bulk_All_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Direct`)
};

const zh_mcp_bulk_all_direct = /** @type {(inputs: Mcp_Bulk_All_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全部直连`)
};

/**
* | output |
* | --- |
* | "All Direct" |
*
* @param {Mcp_Bulk_All_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bulk_all_direct = /** @type {((inputs?: Mcp_Bulk_All_DirectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Bulk_All_DirectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_bulk_all_direct(inputs)
	return zh_mcp_bulk_all_direct(inputs)
});