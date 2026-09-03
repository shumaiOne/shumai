/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ParametersInputs */

const en_parameters = /** @type {(inputs: ParametersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Parameters`)
};

const zh_parameters = /** @type {(inputs: ParametersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`参数`)
};

/**
* | output |
* | --- |
* | "Parameters" |
*
* @param {ParametersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const parameters = /** @type {((inputs?: ParametersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ParametersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_parameters(inputs)
	return zh_parameters(inputs)
});