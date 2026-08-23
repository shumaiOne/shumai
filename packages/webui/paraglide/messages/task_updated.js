/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_UpdatedInputs */

const en_task_updated = /** @type {(inputs: Task_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task updated`)
};

const zh_task_updated = /** @type {(inputs: Task_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已更新`)
};

/**
* | output |
* | --- |
* | "Task updated" |
*
* @param {Task_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_updated = /** @type {((inputs?: Task_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_updated(inputs)
	return zh_task_updated(inputs)
});