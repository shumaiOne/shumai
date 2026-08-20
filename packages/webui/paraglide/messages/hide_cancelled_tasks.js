/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hide_Cancelled_TasksInputs */

const en_hide_cancelled_tasks = /** @type {(inputs: Hide_Cancelled_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hide Cancelled Tasks`)
};

const zh_hide_cancelled_tasks = /** @type {(inputs: Hide_Cancelled_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`隐藏已取消任务`)
};

/**
* | output |
* | --- |
* | "Hide Cancelled Tasks" |
*
* @param {Hide_Cancelled_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_cancelled_tasks = /** @type {((inputs?: Hide_Cancelled_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hide_Cancelled_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hide_cancelled_tasks(inputs)
	return zh_hide_cancelled_tasks(inputs)
});