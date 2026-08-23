/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_DescriptionInputs */

const en_task_description = /** @type {(inputs: Task_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Description`)
};

const zh_task_description = /** @type {(inputs: Task_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务描述`)
};

/**
* | output |
* | --- |
* | "Description" |
*
* @param {Task_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_description = /** @type {((inputs?: Task_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_description(inputs)
	return zh_task_description(inputs)
});