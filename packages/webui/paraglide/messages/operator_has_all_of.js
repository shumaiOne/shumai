/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Has_All_OfInputs */

const en_operator_has_all_of = /** @type {(inputs: Operator_Has_All_OfInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`has all of`)
};

const zh_operator_has_all_of = /** @type {(inputs: Operator_Has_All_OfInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`含有全部`)
};

/**
* | output |
* | --- |
* | "has all of" |
*
* @param {Operator_Has_All_OfInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_has_all_of = /** @type {((inputs?: Operator_Has_All_OfInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Has_All_OfInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_operator_has_all_of(inputs)
	return zh_operator_has_all_of(inputs)
});