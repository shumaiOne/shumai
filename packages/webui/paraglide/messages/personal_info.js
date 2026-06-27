/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Personal_InfoInputs */

const en_personal_info = /** @type {(inputs: Personal_InfoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Personal Info`)
};

const zh_personal_info = /** @type {(inputs: Personal_InfoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`个人信息`)
};

/**
* | output |
* | --- |
* | "Personal Info" |
*
* @param {Personal_InfoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const personal_info = /** @type {((inputs?: Personal_InfoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Personal_InfoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_personal_info(inputs)
	return zh_personal_info(inputs)
});