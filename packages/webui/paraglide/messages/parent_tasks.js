/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Parent_TasksInputs */

const en_parent_tasks = /** @type {(inputs: Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Parent Tasks`)
};

const zh_parent_tasks = /** @type {(inputs: Parent_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`前置任务`)
};

/**
* | output |
* | --- |
* | "Parent Tasks" |
*
* @param {Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const parent_tasks = /** @type {((inputs?: Parent_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Parent_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_parent_tasks(inputs)
	return zh_parent_tasks(inputs)
});