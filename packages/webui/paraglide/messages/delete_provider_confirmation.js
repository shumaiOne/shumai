/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Delete_Provider_ConfirmationInputs */

const en_delete_provider_confirmation = /** @type {(inputs: Delete_Provider_ConfirmationInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`This action cannot be undone. This will permanently delete the provider "${i?.name}" and all associated model configurations.`)
};

const zh_delete_provider_confirmation = /** @type {(inputs: Delete_Provider_ConfirmationInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`此操作无法撤销。这将永久删除提供商 "${i?.name}" 及所有关联的模型配置。`)
};

/**
* | output |
* | --- |
* | "This action cannot be undone. This will permanently delete the provider \"{name}\" and all associated model configurations." |
*
* @param {Delete_Provider_ConfirmationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_provider_confirmation = /** @type {((inputs: Delete_Provider_ConfirmationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Provider_ConfirmationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_provider_confirmation(inputs)
	return zh_delete_provider_confirmation(inputs)
});