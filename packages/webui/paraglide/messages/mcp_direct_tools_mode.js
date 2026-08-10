/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Direct_Tools_ModeInputs */

const en_mcp_direct_tools_mode = /** @type {(inputs: Mcp_Direct_Tools_ModeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Direct Tools Mode`)
};

const zh_mcp_direct_tools_mode = /** @type {(inputs: Mcp_Direct_Tools_ModeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`直连工具模式`)
};

/**
* | output |
* | --- |
* | "Direct Tools Mode" |
*
* @param {Mcp_Direct_Tools_ModeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_mode = /** @type {((inputs?: Mcp_Direct_Tools_ModeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Direct_Tools_ModeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_direct_tools_mode(inputs)
	return zh_mcp_direct_tools_mode(inputs)
});