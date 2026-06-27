/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_RemoveInputs */

const en_failed_remove = /** @type {(inputs: Failed_RemoveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to remove`)
};

const zh_failed_remove = /** @type {(inputs: Failed_RemoveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除失败`)
};

/**
* | output |
* | --- |
* | "Failed to remove" |
*
* @param {Failed_RemoveInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_remove = /** @type {((inputs?: Failed_RemoveInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_RemoveInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_remove(inputs)
	return zh_failed_remove(inputs)
});