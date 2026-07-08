/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_SessionInputs */

const en_failed_delete_session = /** @type {(inputs: Failed_Delete_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete session`)
};

const zh_failed_delete_session = /** @type {(inputs: Failed_Delete_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除会话失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete session" |
*
* @param {Failed_Delete_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_session = /** @type {((inputs?: Failed_Delete_SessionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_SessionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_session(inputs)
	return zh_failed_delete_session(inputs)
});