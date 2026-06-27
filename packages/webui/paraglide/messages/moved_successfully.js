/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Moved_SuccessfullyInputs */

const en_moved_successfully = /** @type {(inputs: Moved_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Moved successfully`)
};

const zh_moved_successfully = /** @type {(inputs: Moved_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移动成功`)
};

/**
* | output |
* | --- |
* | "Moved successfully" |
*
* @param {Moved_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const moved_successfully = /** @type {((inputs?: Moved_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Moved_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_moved_successfully(inputs)
	return zh_moved_successfully(inputs)
});