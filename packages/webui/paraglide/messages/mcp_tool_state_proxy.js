/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Tool_State_ProxyInputs */

const en_mcp_tool_state_proxy = /** @type {(inputs: Mcp_Tool_State_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Proxy`)
};

const zh_mcp_tool_state_proxy = /** @type {(inputs: Mcp_Tool_State_ProxyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`代理`)
};

/**
* | output |
* | --- |
* | "Proxy" |
*
* @param {Mcp_Tool_State_ProxyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_state_proxy = /** @type {((inputs?: Mcp_Tool_State_ProxyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Tool_State_ProxyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_tool_state_proxy(inputs)
	return zh_mcp_tool_state_proxy(inputs)
});