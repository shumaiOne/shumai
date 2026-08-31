/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_SessionInputs */

const en_delete_session = /** @type {(inputs: Delete_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Session`)
};

const zh_delete_session = /** @type {(inputs: Delete_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除会话`)
};

/**
* | output |
* | --- |
* | "Delete Session" |
*
* @param {Delete_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_session = /** @type {((inputs?: Delete_SessionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_SessionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_session(inputs)
	return zh_delete_session(inputs)
});