/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Excluded_Tools_HintInputs */

const en_mcp_excluded_tools_hint = /** @type {(inputs: Mcp_Excluded_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disable a tool to exclude it from this server's toolset.`)
};

const zh_mcp_excluded_tools_hint = /** @type {(inputs: Mcp_Excluded_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关闭某个工具会将其从该服务的工具集中排除。`)
};

/**
* | output |
* | --- |
* | "Disable a tool to exclude it from this server's toolset." |
*
* @param {Mcp_Excluded_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_excluded_tools_hint = /** @type {((inputs?: Mcp_Excluded_Tools_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Excluded_Tools_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_excluded_tools_hint(inputs)
	return zh_mcp_excluded_tools_hint(inputs)
});