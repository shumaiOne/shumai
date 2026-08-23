/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Start_TaskInputs */

const en_start_task = /** @type {(inputs: Start_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start Task`)
};

const zh_start_task = /** @type {(inputs: Start_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`开始任务`)
};

/**
* | output |
* | --- |
* | "Start Task" |
*
* @param {Start_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const start_task = /** @type {((inputs?: Start_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Start_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_start_task(inputs)
	return zh_start_task(inputs)
});