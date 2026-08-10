/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Mcp_Tools_CountInputs */

const en_mcp_tools_count = /** @type {(inputs: Mcp_Tools_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Tools`)
};

const zh_mcp_tools_count = /** @type {(inputs: Mcp_Tools_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个工具`)
};

/**
* | output |
* | --- |
* | "{count} Tools" |
*
* @param {Mcp_Tools_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tools_count = /** @type {((inputs: Mcp_Tools_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tools_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tools_count(inputs)
	return zh_mcp_tools_count(inputs)
});