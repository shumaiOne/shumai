/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Delete_Model_ConfirmationInputs */

const en_delete_model_confirmation = /** @type {(inputs: Delete_Model_ConfirmationInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`This action cannot be undone. This will permanently delete the model "${i?.name}".`)
};

const zh_delete_model_confirmation = /** @type {(inputs: Delete_Model_ConfirmationInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`此操作无法撤销。这将永久删除模型 "${i?.name}"。`)
};

/**
* | output |
* | --- |
* | "This action cannot be undone. This will permanently delete the model \"{name}\"." |
*
* @param {Delete_Model_ConfirmationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_model_confirmation = /** @type {((inputs: Delete_Model_ConfirmationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Model_ConfirmationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_model_confirmation(inputs)
	return zh_delete_model_confirmation(inputs)
});