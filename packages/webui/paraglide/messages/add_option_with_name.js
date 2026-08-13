/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Add_Option_With_NameInputs */

const en_add_option_with_name = /** @type {(inputs: Add_Option_With_NameInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Add options: ${i?.name}`)
};

const zh_add_option_with_name = /** @type {(inputs: Add_Option_With_NameInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`添加选项：${i?.name}`)
};

/**
* | output |
* | --- |
* | "Add options: {name}" |
*
* @param {Add_Option_With_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_option_with_name = /** @type {((inputs: Add_Option_With_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Option_With_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_option_with_name(inputs)
	return zh_add_option_with_name(inputs)
});