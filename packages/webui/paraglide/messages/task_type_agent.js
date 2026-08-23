/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Type_AgentInputs */

const en_task_type_agent = /** @type {(inputs: Task_Type_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent Task`)
};

const zh_task_type_agent = /** @type {(inputs: Task_Type_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体任务`)
};

/**
* | output |
* | --- |
* | "Agent Task" |
*
* @param {Task_Type_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_agent = /** @type {((inputs?: Task_Type_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Type_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type_agent(inputs)
	return zh_task_type_agent(inputs)
});