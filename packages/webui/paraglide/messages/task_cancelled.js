/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_CancelledInputs */

const en_task_cancelled = /** @type {(inputs: Task_CancelledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task cancelled`)
};

const zh_task_cancelled = /** @type {(inputs: Task_CancelledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已取消`)
};

/**
* | output |
* | --- |
* | "Task cancelled" |
*
* @param {Task_CancelledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_cancelled = /** @type {((inputs?: Task_CancelledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_CancelledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_cancelled(inputs)
	return zh_task_cancelled(inputs)
});