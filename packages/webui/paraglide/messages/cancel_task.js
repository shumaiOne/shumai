/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cancel_TaskInputs */

const en_cancel_task = /** @type {(inputs: Cancel_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cancel Task`)
};

const zh_cancel_task = /** @type {(inputs: Cancel_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`取消任务`)
};

/**
* | output |
* | --- |
* | "Cancel Task" |
*
* @param {Cancel_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cancel_task = /** @type {((inputs?: Cancel_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cancel_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cancel_task(inputs)
	return zh_cancel_task(inputs)
});