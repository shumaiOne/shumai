/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copied_SuccessfullyInputs */

const en_copied_successfully = /** @type {(inputs: Copied_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copied successfully`)
};

const zh_copied_successfully = /** @type {(inputs: Copied_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`复制成功`)
};

/**
* | output |
* | --- |
* | "Copied successfully" |
*
* @param {Copied_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied_successfully = /** @type {((inputs?: Copied_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copied_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copied_successfully(inputs)
	return zh_copied_successfully(inputs)
});