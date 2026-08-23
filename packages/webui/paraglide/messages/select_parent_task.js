/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Parent_TaskInputs */

const en_select_parent_task = /** @type {(inputs: Select_Parent_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Parent Task`)
};

const zh_select_parent_task = /** @type {(inputs: Select_Parent_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择前置任务`)
};

/**
* | output |
* | --- |
* | "Select Parent Task" |
*
* @param {Select_Parent_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_parent_task = /** @type {((inputs?: Select_Parent_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Parent_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_parent_task(inputs)
	return zh_select_parent_task(inputs)
});