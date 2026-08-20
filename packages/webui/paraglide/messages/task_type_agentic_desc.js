/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Type_Agentic_DescInputs */

const en_task_type_agentic_desc = /** @type {(inputs: Task_Type_Agentic_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Executed autonomously by an AI agent`)
};

const zh_task_type_agentic_desc = /** @type {(inputs: Task_Type_Agentic_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`由 AI 智能体自主执行`)
};

/**
* | output |
* | --- |
* | "Executed autonomously by an AI agent" |
*
* @param {Task_Type_Agentic_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_agentic_desc = /** @type {((inputs?: Task_Type_Agentic_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Type_Agentic_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type_agentic_desc(inputs)
	return zh_task_type_agentic_desc(inputs)
});