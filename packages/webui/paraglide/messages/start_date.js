/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Start_DateInputs */

const en_start_date = /** @type {(inputs: Start_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start Date`)
};

const zh_start_date = /** @type {(inputs: Start_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`开始日期`)
};

/**
* | output |
* | --- |
* | "Start Date" |
*
* @param {Start_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const start_date = /** @type {((inputs?: Start_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Start_DateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_start_date(inputs)
	return zh_start_date(inputs)
});