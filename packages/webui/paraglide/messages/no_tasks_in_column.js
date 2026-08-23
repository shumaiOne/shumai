/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Tasks_In_ColumnInputs */

const en_no_tasks_in_column = /** @type {(inputs: No_Tasks_In_ColumnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No tasks in this column`)
};

const zh_no_tasks_in_column = /** @type {(inputs: No_Tasks_In_ColumnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`该列暂无任务`)
};

/**
* | output |
* | --- |
* | "No tasks in this column" |
*
* @param {No_Tasks_In_ColumnInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_tasks_in_column = /** @type {((inputs?: No_Tasks_In_ColumnInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Tasks_In_ColumnInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_tasks_in_column(inputs)
	return zh_no_tasks_in_column(inputs)
});