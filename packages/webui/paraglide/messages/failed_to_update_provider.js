/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Update_ProviderInputs */

const en_failed_to_update_provider = /** @type {(inputs: Failed_To_Update_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update provider`)
};

const zh_failed_to_update_provider = /** @type {(inputs: Failed_To_Update_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新提供商失败`)
};

/**
* | output |
* | --- |
* | "Failed to update provider" |
*
* @param {Failed_To_Update_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_update_provider = /** @type {((inputs?: Failed_To_Update_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Update_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_update_provider(inputs)
	return zh_failed_to_update_provider(inputs)
});