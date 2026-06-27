/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_PermanentlyInputs */

const en_delete_permanently = /** @type {(inputs: Delete_PermanentlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Permanently`)
};

const zh_delete_permanently = /** @type {(inputs: Delete_PermanentlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`永久删除`)
};

/**
* | output |
* | --- |
* | "Delete Permanently" |
*
* @param {Delete_PermanentlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_permanently = /** @type {((inputs?: Delete_PermanentlyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_PermanentlyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_permanently(inputs)
	return zh_delete_permanently(inputs)
});