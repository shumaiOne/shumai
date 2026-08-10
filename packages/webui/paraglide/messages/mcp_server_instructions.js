/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Server_InstructionsInputs */

const en_mcp_server_instructions = /** @type {(inputs: Mcp_Server_InstructionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Server Instructions`)
};

const zh_mcp_server_instructions = /** @type {(inputs: Mcp_Server_InstructionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`服务器说明`)
};

/**
* | output |
* | --- |
* | "Server Instructions" |
*
* @param {Mcp_Server_InstructionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_instructions = /** @type {((inputs?: Mcp_Server_InstructionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Server_InstructionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_server_instructions(inputs)
	return zh_mcp_server_instructions(inputs)
});