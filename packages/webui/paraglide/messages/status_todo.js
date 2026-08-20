/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_TodoInputs */

const en_status_todo = /** @type {(inputs: Status_TodoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`To Do`)
};

const zh_status_todo = /** @type {(inputs: Status_TodoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`待办`)
};

/**
* | output |
* | --- |
* | "To Do" |
*
* @param {Status_TodoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_todo = /** @type {((inputs?: Status_TodoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_TodoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_todo(inputs)
	return zh_status_todo(inputs)
});