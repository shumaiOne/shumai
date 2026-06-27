/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_NowInputs */

const en_delete_now = /** @type {(inputs: Delete_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Now`)
};

const zh_delete_now = /** @type {(inputs: Delete_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`立即删除`)
};

/**
* | output |
* | --- |
* | "Delete Now" |
*
* @param {Delete_NowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_now = /** @type {((inputs?: Delete_NowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_NowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_now(inputs)
	return zh_delete_now(inputs)
});