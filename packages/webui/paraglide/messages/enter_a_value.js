/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_A_ValueInputs */

const en_enter_a_value = /** @type {(inputs: Enter_A_ValueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter a value`)
};

const zh_enter_a_value = /** @type {(inputs: Enter_A_ValueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入一个值`)
};

/**
* | output |
* | --- |
* | "Enter a value" |
*
* @param {Enter_A_ValueInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_a_value = /** @type {((inputs?: Enter_A_ValueInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_A_ValueInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enter_a_value(inputs)
	return zh_enter_a_value(inputs)
});