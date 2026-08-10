/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Tool_ParametersInputs */

const en_tool_parameters = /** @type {(inputs: Tool_ParametersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Parameters`)
};

const zh_tool_parameters = /** @type {(inputs: Tool_ParametersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`参数列表`)
};

/**
* | output |
* | --- |
* | "Parameters" |
*
* @param {Tool_ParametersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_parameters = /** @type {((inputs?: Tool_ParametersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tool_ParametersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tool_parameters(inputs)
	return zh_tool_parameters(inputs)
});