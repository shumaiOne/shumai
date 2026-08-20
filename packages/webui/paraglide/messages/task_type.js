/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_TypeInputs */

const en_task_type = /** @type {(inputs: Task_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task Type`)
};

const zh_task_type = /** @type {(inputs: Task_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务类型`)
};

/**
* | output |
* | --- |
* | "Task Type" |
*
* @param {Task_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type = /** @type {((inputs?: Task_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type(inputs)
	return zh_task_type(inputs)
});