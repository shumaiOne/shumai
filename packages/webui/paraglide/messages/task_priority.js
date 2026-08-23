/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_PriorityInputs */

const en_task_priority = /** @type {(inputs: Task_PriorityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Priority`)
};

const zh_task_priority = /** @type {(inputs: Task_PriorityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`优先级`)
};

/**
* | output |
* | --- |
* | "Priority" |
*
* @param {Task_PriorityInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_priority = /** @type {((inputs?: Task_PriorityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_PriorityInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_priority(inputs)
	return zh_task_priority(inputs)
});