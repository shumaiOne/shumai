/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_PermanentlyInputs */

const en_failed_delete_permanently = /** @type {(inputs: Failed_Delete_PermanentlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete permanently`)
};

const zh_failed_delete_permanently = /** @type {(inputs: Failed_Delete_PermanentlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`永久删除失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete permanently" |
*
* @param {Failed_Delete_PermanentlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_permanently = /** @type {((inputs?: Failed_Delete_PermanentlyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_PermanentlyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_permanently(inputs)
	return zh_failed_delete_permanently(inputs)
});