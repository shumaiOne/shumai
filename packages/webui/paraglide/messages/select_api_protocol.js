/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Api_ProtocolInputs */

const en_select_api_protocol = /** @type {(inputs: Select_Api_ProtocolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select API Protocol`)
};

const zh_select_api_protocol = /** @type {(inputs: Select_Api_ProtocolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择 API 协议`)
};

/**
* | output |
* | --- |
* | "Select API Protocol" |
*
* @param {Select_Api_ProtocolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_api_protocol = /** @type {((inputs?: Select_Api_ProtocolInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Api_ProtocolInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_api_protocol(inputs)
	return zh_select_api_protocol(inputs)
});