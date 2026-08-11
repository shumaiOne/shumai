/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Status_FailedInputs */

const en_mcp_status_failed = /** @type {(inputs: Mcp_Status_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed`)
};

const zh_mcp_status_failed = /** @type {(inputs: Mcp_Status_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`连接失败`)
};

/**
* | output |
* | --- |
* | "Failed" |
*
* @param {Mcp_Status_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_status_failed = /** @type {((inputs?: Mcp_Status_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Status_FailedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_status_failed(inputs)
	return zh_mcp_status_failed(inputs)
});