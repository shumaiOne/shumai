/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Variable_NameInputs */

const en_variable_name = /** @type {(inputs: Variable_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Variable Name`)
};

const zh_variable_name = /** @type {(inputs: Variable_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`变量名称`)
};

/**
* | output |
* | --- |
* | "Variable Name" |
*
* @param {Variable_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const variable_name = /** @type {((inputs?: Variable_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Variable_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_variable_name(inputs)
	return zh_variable_name(inputs)
});