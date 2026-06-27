/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SecurityInputs */

const en_security = /** @type {(inputs: SecurityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Security`)
};

const zh_security = /** @type {(inputs: SecurityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`安全`)
};

/**
* | output |
* | --- |
* | "Security" |
*
* @param {SecurityInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const security = /** @type {((inputs?: SecurityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SecurityInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_security(inputs)
	return zh_security(inputs)
});