/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Task_To_LinkInputs */

const en_select_task_to_link = /** @type {(inputs: Select_Task_To_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select task to link...`)
};

const zh_select_task_to_link = /** @type {(inputs: Select_Task_To_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择要关联的任务...`)
};

/**
* | output |
* | --- |
* | "Select task to link..." |
*
* @param {Select_Task_To_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_task_to_link = /** @type {((inputs?: Select_Task_To_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Task_To_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_task_to_link(inputs)
	return zh_select_task_to_link(inputs)
});