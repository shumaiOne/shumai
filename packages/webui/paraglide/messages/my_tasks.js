/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} My_TasksInputs */

const en_my_tasks = /** @type {(inputs: My_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`My Tasks`)
};

const zh_my_tasks = /** @type {(inputs: My_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`我的任务`)
};

/**
* | output |
* | --- |
* | "My Tasks" |
*
* @param {My_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const my_tasks = /** @type {((inputs?: My_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<My_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_my_tasks(inputs)
	return zh_my_tasks(inputs)
});