/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_CreatedInputs */

const en_task_created = /** @type {(inputs: Task_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task created`)
};

const zh_task_created = /** @type {(inputs: Task_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已创建`)
};

/**
* | output |
* | --- |
* | "Task created" |
*
* @param {Task_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_created = /** @type {((inputs?: Task_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_created(inputs)
	return zh_task_created(inputs)
});