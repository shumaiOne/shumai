/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Remove_Model_ConfirmInputs */

const en_remove_model_confirm = /** @type {(inputs: Remove_Model_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Are you sure you want to remove this model?`)
};

const zh_remove_model_confirm = /** @type {(inputs: Remove_Model_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确定要移除此模型吗？`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to remove this model?" |
*
* @param {Remove_Model_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_model_confirm = /** @type {((inputs?: Remove_Model_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_Model_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_remove_model_confirm(inputs)
	return zh_remove_model_confirm(inputs)
});