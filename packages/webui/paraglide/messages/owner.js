/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OwnerInputs */

const en_owner = /** @type {(inputs: OwnerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Owner`)
};

const zh_owner = /** @type {(inputs: OwnerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有者`)
};

/**
* | output |
* | --- |
* | "Owner" |
*
* @param {OwnerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const owner = /** @type {((inputs?: OwnerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OwnerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_owner(inputs)
	return zh_owner(inputs)
});