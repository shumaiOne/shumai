/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Parent_TasksInputs */

const en_select_parent_tasks = /** @type {(inputs: Select_Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select parent tasks...`)
};

const zh_select_parent_tasks = /** @type {(inputs: Select_Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择前置任务...`)
};

/**
* | output |
* | --- |
* | "Select parent tasks..." |
*
* @param {Select_Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_parent_tasks = /** @type {((inputs?: Select_Parent_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Parent_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_parent_tasks(inputs)
	return zh_select_parent_tasks(inputs)
});