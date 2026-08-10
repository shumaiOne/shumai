/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Direct_Tools_DescInputs */

const en_mcp_direct_tools_desc = /** @type {(inputs: Mcp_Direct_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Expose each server tool directly in the prompt instead of multiplexing through the proxy tool.`)
};

const zh_mcp_direct_tools_desc = /** @type {(inputs: Mcp_Direct_Tools_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`将服务的每个工具直接暴露在提示词中，而非通过代理工具复用。`)
};

/**
* | output |
* | --- |
* | "Expose each server tool directly in the prompt instead of multiplexing through the proxy tool." |
*
* @param {Mcp_Direct_Tools_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_desc = /** @type {((inputs?: Mcp_Direct_Tools_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Direct_Tools_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_direct_tools_desc(inputs)
	return zh_mcp_direct_tools_desc(inputs)
});