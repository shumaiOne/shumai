/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_TaskInputs */

const en_delete_task = /** @type {(inputs: Delete_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Task`)
};

const zh_delete_task = /** @type {(inputs: Delete_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除任务`)
};

/**
* | output |
* | --- |
* | "Delete Task" |
*
* @param {Delete_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_task = /** @type {((inputs?: Delete_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_task(inputs)
	return zh_delete_task(inputs)
});