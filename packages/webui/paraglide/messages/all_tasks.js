/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_TasksInputs */

const en_all_tasks = /** @type {(inputs: All_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Tasks`)
};

const zh_all_tasks = /** @type {(inputs: All_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有任务`)
};

/**
* | output |
* | --- |
* | "All Tasks" |
*
* @param {All_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_tasks = /** @type {((inputs?: All_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_tasks(inputs)
	return zh_all_tasks(inputs)
});