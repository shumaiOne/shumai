/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_TaskInputs */

const en_unknown_task = /** @type {(inputs: Unknown_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`unknown task`)
};

const zh_unknown_task = /** @type {(inputs: Unknown_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未知任务`)
};

/**
* | output |
* | --- |
* | "unknown task" |
*
* @param {Unknown_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_task = /** @type {((inputs?: Unknown_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unknown_task(inputs)
	return zh_unknown_task(inputs)
});