/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_Api_KeyInputs */

const en_edit_api_key = /** @type {(inputs: Edit_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit API Key`)
};

const zh_edit_api_key = /** @type {(inputs: Edit_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`修改 API 密钥`)
};

/**
* | output |
* | --- |
* | "Edit API Key" |
*
* @param {Edit_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_api_key = /** @type {((inputs?: Edit_Api_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_Api_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_api_key(inputs)
	return zh_edit_api_key(inputs)
});