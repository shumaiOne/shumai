/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ message: NonNullable<unknown> }} Error_MessageInputs */

const en_error_message = /** @type {(inputs: Error_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Error: ${i?.message}`)
};

const zh_error_message = /** @type {(inputs: Error_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`错误：${i?.message}`)
};

/**
* | output |
* | --- |
* | "Error: {message}" |
*
* @param {Error_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const error_message = /** @type {((inputs: Error_MessageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_MessageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_message(inputs)
	return zh_error_message(inputs)
});