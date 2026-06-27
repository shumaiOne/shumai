/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Type_Query_InstructionInputs */

const en_type_query_instruction = /** @type {(inputs: Type_Query_InstructionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type your query above and click the Search button to display results.`)
};

const zh_type_query_instruction = /** @type {(inputs: Type_Query_InstructionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`在上方输入查询内容并点击搜索按钮以显示结果。`)
};

/**
* | output |
* | --- |
* | "Type your query above and click the Search button to display results." |
*
* @param {Type_Query_InstructionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_query_instruction = /** @type {((inputs?: Type_Query_InstructionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Type_Query_InstructionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type_query_instruction(inputs)
	return zh_type_query_instruction(inputs)
});