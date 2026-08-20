/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_ReopenedInputs */

const en_task_reopened = /** @type {(inputs: Task_ReopenedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task reopened`)
};

const zh_task_reopened = /** @type {(inputs: Task_ReopenedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已重新打开`)
};

/**
* | output |
* | --- |
* | "Task reopened" |
*
* @param {Task_ReopenedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_reopened = /** @type {((inputs?: Task_ReopenedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_ReopenedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_reopened(inputs)
	return zh_task_reopened(inputs)
});