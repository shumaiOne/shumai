/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Parent_TasksInputs */

const en_no_parent_tasks = /** @type {(inputs: No_Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No parent tasks`)
};

const zh_no_parent_tasks = /** @type {(inputs: No_Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无前置任务`)
};

/**
* | output |
* | --- |
* | "No parent tasks" |
*
* @param {No_Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_parent_tasks = /** @type {((inputs?: No_Parent_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Parent_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_parent_tasks(inputs)
	return zh_no_parent_tasks(inputs)
});