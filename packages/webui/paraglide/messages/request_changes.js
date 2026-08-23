/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Request_ChangesInputs */

const en_request_changes = /** @type {(inputs: Request_ChangesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Request Changes`)
};

const zh_request_changes = /** @type {(inputs: Request_ChangesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请求修改`)
};

/**
* | output |
* | --- |
* | "Request Changes" |
*
* @param {Request_ChangesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const request_changes = /** @type {((inputs?: Request_ChangesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Request_ChangesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_request_changes(inputs)
	return zh_request_changes(inputs)
});