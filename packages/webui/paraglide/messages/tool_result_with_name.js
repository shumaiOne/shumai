/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Tool_Result_With_NameInputs */

const en_tool_result_with_name = /** @type {(inputs: Tool_Result_With_NameInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Tool Result: ${i?.name}`)
};

const zh_tool_result_with_name = /** @type {(inputs: Tool_Result_With_NameInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`工具结果：${i?.name}`)
};

/**
* | output |
* | --- |
* | "Tool Result: {name}" |
*
* @param {Tool_Result_With_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_result_with_name = /** @type {((inputs: Tool_Result_With_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tool_Result_With_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tool_result_with_name(inputs)
	return zh_tool_result_with_name(inputs)
});