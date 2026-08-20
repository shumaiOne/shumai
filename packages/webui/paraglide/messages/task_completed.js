/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_CompletedInputs */

const en_task_completed = /** @type {(inputs: Task_CompletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task completed`)
};

const zh_task_completed = /** @type {(inputs: Task_CompletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已完成`)
};

/**
* | output |
* | --- |
* | "Task completed" |
*
* @param {Task_CompletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_completed = /** @type {((inputs?: Task_CompletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_CompletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_completed(inputs)
	return zh_task_completed(inputs)
});