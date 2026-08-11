/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_State_DirectInputs */

const en_mcp_tool_state_direct = /** @type {(inputs: Mcp_Tool_State_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Direct`)
};

const zh_mcp_tool_state_direct = /** @type {(inputs: Mcp_Tool_State_DirectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`直连`)
};

/**
* | output |
* | --- |
* | "Direct" |
*
* @param {Mcp_Tool_State_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_state_direct = /** @type {((inputs?: Mcp_Tool_State_DirectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_State_DirectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_state_direct(inputs)
	return zh_mcp_tool_state_direct(inputs)
});