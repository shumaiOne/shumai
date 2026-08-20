/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_TaskInputs */

const en_edit_task = /** @type {(inputs: Edit_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit Task`)
};

const zh_edit_task = /** @type {(inputs: Edit_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`编辑任务`)
};

/**
* | output |
* | --- |
* | "Edit Task" |
*
* @param {Edit_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_task = /** @type {((inputs?: Edit_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_task(inputs)
	return zh_edit_task(inputs)
});