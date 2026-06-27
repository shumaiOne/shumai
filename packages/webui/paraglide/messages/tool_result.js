/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Tool_ResultInputs */

const en_tool_result = /** @type {(inputs: Tool_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Tool Result:`)
};

const zh_tool_result = /** @type {(inputs: Tool_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`工具结果：`)
};

/**
* | output |
* | --- |
* | "Tool Result:" |
*
* @param {Tool_ResultInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_result = /** @type {((inputs?: Tool_ResultInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tool_ResultInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tool_result(inputs)
	return zh_tool_result(inputs)
});