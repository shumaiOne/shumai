/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Server_Auto_DetectedInputs */

const en_mcp_server_auto_detected = /** @type {(inputs: Mcp_Server_Auto_DetectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Name and description are auto-detected from the server after connecting.`)
};

const zh_mcp_server_auto_detected = /** @type {(inputs: Mcp_Server_Auto_DetectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`连接后将自动从服务端获取名称和描述。`)
};

/**
* | output |
* | --- |
* | "Name and description are auto-detected from the server after connecting." |
*
* @param {Mcp_Server_Auto_DetectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_auto_detected = /** @type {((inputs?: Mcp_Server_Auto_DetectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Server_Auto_DetectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_server_auto_detected(inputs)
	return zh_mcp_server_auto_detected(inputs)
});