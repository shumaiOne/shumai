/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_StartedInputs */

const en_task_started = /** @type {(inputs: Task_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task started`)
};

const zh_task_started = /** @type {(inputs: Task_StartedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已开始`)
};

/**
* | output |
* | --- |
* | "Task started" |
*
* @param {Task_StartedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_started = /** @type {((inputs?: Task_StartedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_StartedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_started(inputs)
	return zh_task_started(inputs)
});