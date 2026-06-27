/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Created_DateInputs */

const en_created_date = /** @type {(inputs: Created_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Created Date`)
};

const zh_created_date = /** @type {(inputs: Created_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建日期`)
};

/**
* | output |
* | --- |
* | "Created Date" |
*
* @param {Created_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const created_date = /** @type {((inputs?: Created_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Created_DateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_created_date(inputs)
	return zh_created_date(inputs)
});