/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OperatorInputs */

const en_operator = /** @type {(inputs: OperatorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Operator`)
};

const zh_operator = /** @type {(inputs: OperatorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`运算符`)
};

/**
* | output |
* | --- |
* | "Operator" |
*
* @param {OperatorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator = /** @type {((inputs?: OperatorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OperatorInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_operator(inputs)
	return zh_operator(inputs)
});