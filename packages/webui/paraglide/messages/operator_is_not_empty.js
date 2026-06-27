/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_Not_EmptyInputs */

const en_operator_is_not_empty = /** @type {(inputs: Operator_Is_Not_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`is not empty`)
};

const zh_operator_is_not_empty = /** @type {(inputs: Operator_Is_Not_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`不为空`)
};

/**
* | output |
* | --- |
* | "is not empty" |
*
* @param {Operator_Is_Not_EmptyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_not_empty = /** @type {((inputs?: Operator_Is_Not_EmptyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_Not_EmptyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_operator_is_not_empty(inputs)
	return zh_operator_is_not_empty(inputs)
});