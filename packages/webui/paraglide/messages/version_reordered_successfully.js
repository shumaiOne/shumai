/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Version_Reordered_SuccessfullyInputs */

const en_version_reordered_successfully = /** @type {(inputs: Version_Reordered_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Version order updated`)
};

const zh_version_reordered_successfully = /** @type {(inputs: Version_Reordered_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`版本顺序已更新`)
};

/**
* | output |
* | --- |
* | "Version order updated" |
*
* @param {Version_Reordered_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const version_reordered_successfully = /** @type {((inputs?: Version_Reordered_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Version_Reordered_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_version_reordered_successfully(inputs)
	return zh_version_reordered_successfully(inputs)
});