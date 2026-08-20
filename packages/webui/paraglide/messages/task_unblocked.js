/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_UnblockedInputs */

const en_task_unblocked = /** @type {(inputs: Task_UnblockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task unblocked`)
};

const zh_task_unblocked = /** @type {(inputs: Task_UnblockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已解除阻塞`)
};

/**
* | output |
* | --- |
* | "Task unblocked" |
*
* @param {Task_UnblockedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_unblocked = /** @type {((inputs?: Task_UnblockedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_UnblockedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_unblocked(inputs)
	return zh_task_unblocked(inputs)
});