/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_ModelInputs */

const en_delete_model = /** @type {(inputs: Delete_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Model`)
};

const zh_delete_model = /** @type {(inputs: Delete_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除模型`)
};

/**
* | output |
* | --- |
* | "Delete Model" |
*
* @param {Delete_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_model = /** @type {((inputs?: Delete_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_ModelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_model(inputs)
	return zh_delete_model(inputs)
});