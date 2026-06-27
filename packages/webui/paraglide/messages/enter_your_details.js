/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Your_DetailsInputs */

const en_enter_your_details = /** @type {(inputs: Enter_Your_DetailsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter your details`)
};

const zh_enter_your_details = /** @type {(inputs: Enter_Your_DetailsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入您的信息`)
};

/**
* | output |
* | --- |
* | "Enter your details" |
*
* @param {Enter_Your_DetailsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_your_details = /** @type {((inputs?: Enter_Your_DetailsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Your_DetailsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enter_your_details(inputs)
	return zh_enter_your_details(inputs)
});