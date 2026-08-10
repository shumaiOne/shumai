/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_TransportInputs */

const en_mcp_transport = /** @type {(inputs: Mcp_TransportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport Protocol`)
};

const zh_mcp_transport = /** @type {(inputs: Mcp_TransportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`传输协议`)
};

/**
* | output |
* | --- |
* | "Transport Protocol" |
*
* @param {Mcp_TransportInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_transport = /** @type {((inputs?: Mcp_TransportInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_TransportInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_transport(inputs)
	return zh_mcp_transport(inputs)
});