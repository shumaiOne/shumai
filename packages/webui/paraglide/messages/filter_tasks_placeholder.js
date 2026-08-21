/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filter_Tasks_PlaceholderInputs */

const en_filter_tasks_placeholder = /** @type {(inputs: Filter_Tasks_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search tasks in this status...`)
};

const zh_filter_tasks_placeholder = /** @type {(inputs: Filter_Tasks_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索此状态下的任务...`)
};

/**
* | output |
* | --- |
* | "Search tasks in this status..." |
*
* @param {Filter_Tasks_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_tasks_placeholder = /** @type {((inputs?: Filter_Tasks_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filter_Tasks_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filter_tasks_placeholder(inputs)
	return zh_filter_tasks_placeholder(inputs)
});