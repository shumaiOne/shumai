/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_TasksInputs */

const en_search_tasks = /** @type {(inputs: Search_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search tasks...`)
};

const zh_search_tasks = /** @type {(inputs: Search_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索任务...`)
};

/**
* | output |
* | --- |
* | "Search tasks..." |
*
* @param {Search_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_tasks = /** @type {((inputs?: Search_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_tasks(inputs)
	return zh_search_tasks(inputs)
});