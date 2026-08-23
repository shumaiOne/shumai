/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_TaskInputs */

const en_create_task = /** @type {(inputs: Create_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Task`)
};

const zh_create_task = /** @type {(inputs: Create_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建任务`)
};

/**
* | output |
* | --- |
* | "Create Task" |
*
* @param {Create_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_task = /** @type {((inputs?: Create_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_task(inputs)
	return zh_create_task(inputs)
});