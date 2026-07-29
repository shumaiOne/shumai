/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_TimeInputs */

const en_create_time = /** @type {(inputs: Create_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Time`)
};

const zh_create_time = /** @type {(inputs: Create_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建时间`)
};

/**
* | output |
* | --- |
* | "Create Time" |
*
* @param {Create_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_time = /** @type {((inputs?: Create_TimeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_TimeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_time(inputs)
	return zh_create_time(inputs)
});