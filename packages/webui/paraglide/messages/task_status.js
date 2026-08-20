/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_StatusInputs */

const en_task_status = /** @type {(inputs: Task_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Status`)
};

const zh_task_status = /** @type {(inputs: Task_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`状态`)
};

/**
* | output |
* | --- |
* | "Status" |
*
* @param {Task_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_status = /** @type {((inputs?: Task_StatusInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_StatusInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_status(inputs)
	return zh_task_status(inputs)
});