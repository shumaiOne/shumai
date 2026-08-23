/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Complete_TaskInputs */

const en_complete_task = /** @type {(inputs: Complete_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Complete Task`)
};

const zh_complete_task = /** @type {(inputs: Complete_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`完成任务`)
};

/**
* | output |
* | --- |
* | "Complete Task" |
*
* @param {Complete_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const complete_task = /** @type {((inputs?: Complete_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Complete_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_complete_task(inputs)
	return zh_complete_task(inputs)
});