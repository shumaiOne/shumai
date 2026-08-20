/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Show_Cancelled_TasksInputs */

const en_show_cancelled_tasks = /** @type {(inputs: Show_Cancelled_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show Cancelled Tasks`)
};

const zh_show_cancelled_tasks = /** @type {(inputs: Show_Cancelled_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`显示已取消任务`)
};

/**
* | output |
* | --- |
* | "Show Cancelled Tasks" |
*
* @param {Show_Cancelled_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_cancelled_tasks = /** @type {((inputs?: Show_Cancelled_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Show_Cancelled_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_show_cancelled_tasks(inputs)
	return zh_show_cancelled_tasks(inputs)
});