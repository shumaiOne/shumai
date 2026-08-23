/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_TaskInputs */

const en_new_task = /** @type {(inputs: New_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Task`)
};

const zh_new_task = /** @type {(inputs: New_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新建任务`)
};

/**
* | output |
* | --- |
* | "New Task" |
*
* @param {New_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_task = /** @type {((inputs?: New_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_task(inputs)
	return zh_new_task(inputs)
});