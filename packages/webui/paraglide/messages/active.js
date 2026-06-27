/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ActiveInputs */

const en_active = /** @type {(inputs: ActiveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Active`)
};

const zh_active = /** @type {(inputs: ActiveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`启用`)
};

/**
* | output |
* | --- |
* | "Active" |
*
* @param {ActiveInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const active = /** @type {((inputs?: ActiveInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ActiveInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_active(inputs)
	return zh_active(inputs)
});