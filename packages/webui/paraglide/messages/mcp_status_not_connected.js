/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Status_Not_ConnectedInputs */

const en_mcp_status_not_connected = /** @type {(inputs: Mcp_Status_Not_ConnectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not Connected`)
};

const zh_mcp_status_not_connected = /** @type {(inputs: Mcp_Status_Not_ConnectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未连接`)
};

/**
* | output |
* | --- |
* | "Not Connected" |
*
* @param {Mcp_Status_Not_ConnectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_status_not_connected = /** @type {((inputs?: Mcp_Status_Not_ConnectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Status_Not_ConnectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_status_not_connected(inputs)
	return zh_mcp_status_not_connected(inputs)
});