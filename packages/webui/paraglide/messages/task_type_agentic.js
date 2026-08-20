/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Type_AgenticInputs */

const en_task_type_agentic = /** @type {(inputs: Task_Type_AgenticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agentic Task`)
};

const zh_task_type_agentic = /** @type {(inputs: Task_Type_AgenticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体任务`)
};

/**
* | output |
* | --- |
* | "Agentic Task" |
*
* @param {Task_Type_AgenticInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_agentic = /** @type {((inputs?: Task_Type_AgenticInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Type_AgenticInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type_agentic(inputs)
	return zh_task_type_agentic(inputs)
});