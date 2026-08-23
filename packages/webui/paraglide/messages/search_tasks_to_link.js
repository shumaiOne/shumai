/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Tasks_To_LinkInputs */

const en_search_tasks_to_link = /** @type {(inputs: Search_Tasks_To_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search tasks to link...`)
};

const zh_search_tasks_to_link = /** @type {(inputs: Search_Tasks_To_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索要关联的任务...`)
};

/**
* | output |
* | --- |
* | "Search tasks to link..." |
*
* @param {Search_Tasks_To_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_tasks_to_link = /** @type {((inputs?: Search_Tasks_To_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Tasks_To_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_tasks_to_link(inputs)
	return zh_search_tasks_to_link(inputs)
});