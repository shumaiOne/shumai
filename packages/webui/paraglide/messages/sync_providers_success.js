/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ modelCount: NonNullable<unknown>, providerCount: NonNullable<unknown> }} Sync_Providers_SuccessInputs */

const en_sync_providers_success = /** @type {(inputs: Sync_Providers_SuccessInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Successfully added ${i?.modelCount} models across ${i?.providerCount} providers.`)
};

const zh_sync_providers_success = /** @type {(inputs: Sync_Providers_SuccessInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`已成功添加 ${i?.providerCount} 个提供商中的 ${i?.modelCount} 个模型。`)
};

/**
* | output |
* | --- |
* | "Successfully added {modelCount} models across {providerCount} providers." |
*
* @param {Sync_Providers_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_success = /** @type {((inputs: Sync_Providers_SuccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_SuccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_success(inputs)
	return zh_sync_providers_success(inputs)
});