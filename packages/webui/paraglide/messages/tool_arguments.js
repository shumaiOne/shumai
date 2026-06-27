/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Tool_ArgumentsInputs */

const en_tool_arguments = /** @type {(inputs: Tool_ArgumentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Arguments`)
};

const zh_tool_arguments = /** @type {(inputs: Tool_ArgumentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`参数`)
};

/**
* | output |
* | --- |
* | "Arguments" |
*
* @param {Tool_ArgumentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_arguments = /** @type {((inputs?: Tool_ArgumentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tool_ArgumentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tool_arguments(inputs)
	return zh_tool_arguments(inputs)
});