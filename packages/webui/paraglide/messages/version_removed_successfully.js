/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Version_Removed_SuccessfullyInputs */

const en_version_removed_successfully = /** @type {(inputs: Version_Removed_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Version removed from stack`)
};

const zh_version_removed_successfully = /** @type {(inputs: Version_Removed_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已从版本堆栈中移除版本`)
};

/**
* | output |
* | --- |
* | "Version removed from stack" |
*
* @param {Version_Removed_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const version_removed_successfully = /** @type {((inputs?: Version_Removed_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Version_Removed_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_version_removed_successfully(inputs)
	return zh_version_removed_successfully(inputs)
});