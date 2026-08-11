/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_Hint_DirectInputs */

const en_mcp_tool_hint_direct = /** @type {(inputs: Mcp_Tool_Hint_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Exposed directly as native agent tools for key capabilities`)
};

const zh_mcp_tool_hint_direct = /** @type {(inputs: Mcp_Tool_Hint_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`直接暴露为 Agent 原生工具，便于高频/关键工具调用`)
};

/**
* | output |
* | --- |
* | "Exposed directly as native agent tools for key capabilities" |
*
* @param {Mcp_Tool_Hint_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_direct = /** @type {((inputs?: Mcp_Tool_Hint_DirectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_Hint_DirectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_hint_direct(inputs)
	return zh_mcp_tool_hint_direct(inputs)
});