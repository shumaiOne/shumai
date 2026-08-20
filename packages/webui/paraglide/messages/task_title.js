/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_TitleInputs */

const en_task_title = /** @type {(inputs: Task_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task Title`)
};

const zh_task_title = /** @type {(inputs: Task_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务标题`)
};

/**
* | output |
* | --- |
* | "Task Title" |
*
* @param {Task_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_title = /** @type {((inputs?: Task_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_title(inputs)
	return zh_task_title(inputs)
});