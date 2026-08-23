/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Due_DateInputs */

const en_due_date = /** @type {(inputs: Due_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Due Date`)
};

const zh_due_date = /** @type {(inputs: Due_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`截止日期`)
};

/**
* | output |
* | --- |
* | "Due Date" |
*
* @param {Due_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const due_date = /** @type {((inputs?: Due_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Due_DateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_due_date(inputs)
	return zh_due_date(inputs)
});