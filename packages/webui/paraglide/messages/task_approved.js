/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_ApprovedInputs */

const en_task_approved = /** @type {(inputs: Task_ApprovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task approved`)
};

const zh_task_approved = /** @type {(inputs: Task_ApprovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务已批准`)
};

/**
* | output |
* | --- |
* | "Task approved" |
*
* @param {Task_ApprovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_approved = /** @type {((inputs?: Task_ApprovedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_ApprovedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_approved(inputs)
	return zh_task_approved(inputs)
});