/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Type_ManualInputs */

const en_task_type_manual = /** @type {(inputs: Task_Type_ManualInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Human Task`)
};

const zh_task_type_manual = /** @type {(inputs: Task_Type_ManualInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`人工任务`)
};

/**
* | output |
* | --- |
* | "Human Task" |
*
* @param {Task_Type_ManualInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_manual = /** @type {((inputs?: Task_Type_ManualInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Type_ManualInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type_manual(inputs)
	return zh_task_type_manual(inputs)
});