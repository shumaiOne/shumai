/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_ExactlyInputs */

const en_operator_is_exactly = /** @type {(inputs: Operator_Is_ExactlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`is exactly`)
};

const zh_operator_is_exactly = /** @type {(inputs: Operator_Is_ExactlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`完全匹配`)
};

/**
* | output |
* | --- |
* | "is exactly" |
*
* @param {Operator_Is_ExactlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_exactly = /** @type {((inputs?: Operator_Is_ExactlyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_ExactlyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_operator_is_exactly(inputs)
	return zh_operator_is_exactly(inputs)
});