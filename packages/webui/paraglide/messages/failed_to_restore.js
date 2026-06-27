/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_RestoreInputs */

const en_failed_to_restore = /** @type {(inputs: Failed_To_RestoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to restore`)
};

const zh_failed_to_restore = /** @type {(inputs: Failed_To_RestoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`恢复失败`)
};

/**
* | output |
* | --- |
* | "Failed to restore" |
*
* @param {Failed_To_RestoreInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_restore = /** @type {((inputs?: Failed_To_RestoreInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_RestoreInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_restore(inputs)
	return zh_failed_to_restore(inputs)
});