/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_DeletedInputs */

const en_task_deleted = /** @type {(inputs: Task_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task deleted successfully`)
};

const zh_task_deleted = /** @type {(inputs: Task_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已成功删除`)
};

/**
* | output |
* | --- |
* | "Task deleted successfully" |
*
* @param {Task_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_deleted = /** @type {((inputs?: Task_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_deleted(inputs)
	return zh_task_deleted(inputs)
});