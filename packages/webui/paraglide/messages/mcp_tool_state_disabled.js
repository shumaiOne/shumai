/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_State_DisabledInputs */

const en_mcp_tool_state_disabled = /** @type {(inputs: Mcp_Tool_State_DisabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Off`)
};

const zh_mcp_tool_state_disabled = /** @type {(inputs: Mcp_Tool_State_DisabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关闭`)
};

/**
* | output |
* | --- |
* | "Off" |
*
* @param {Mcp_Tool_State_DisabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_state_disabled = /** @type {((inputs?: Mcp_Tool_State_DisabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_State_DisabledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_state_disabled(inputs)
	return zh_mcp_tool_state_disabled(inputs)
});