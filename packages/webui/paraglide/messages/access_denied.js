/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Access_DeniedInputs */

const en_access_denied = /** @type {(inputs: Access_DeniedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Access Denied`)
};

const zh_access_denied = /** @type {(inputs: Access_DeniedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`访问被拒绝`)
};

/**
* | output |
* | --- |
* | "Access Denied" |
*
* @param {Access_DeniedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const access_denied = /** @type {((inputs?: Access_DeniedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Access_DeniedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_access_denied(inputs)
	return zh_access_denied(inputs)
});