/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_RenameInputs */

const en_failed_to_rename = /** @type {(inputs: Failed_To_RenameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to rename`)
};

const zh_failed_to_rename = /** @type {(inputs: Failed_To_RenameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重命名失败`)
};

/**
* | output |
* | --- |
* | "Failed to rename" |
*
* @param {Failed_To_RenameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_rename = /** @type {((inputs?: Failed_To_RenameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_RenameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_rename(inputs)
	return zh_failed_to_rename(inputs)
});