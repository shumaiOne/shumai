/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Matching_TasksInputs */

const en_no_matching_tasks = /** @type {(inputs: No_Matching_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No matching tasks found`)
};

const zh_no_matching_tasks = /** @type {(inputs: No_Matching_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到匹配的任务`)
};

/**
* | output |
* | --- |
* | "No matching tasks found" |
*
* @param {No_Matching_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_matching_tasks = /** @type {((inputs?: No_Matching_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Matching_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_matching_tasks(inputs)
	return zh_no_matching_tasks(inputs)
});