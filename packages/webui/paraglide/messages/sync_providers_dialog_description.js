/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Dialog_DescriptionInputs */

const en_sync_providers_dialog_description = /** @type {(inputs: Sync_Providers_Dialog_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select the new providers and models you want to add. Existing providers, custom endpoints, API keys, and model configurations will never be deleted or modified.`)
};

const zh_sync_providers_dialog_description = /** @type {(inputs: Sync_Providers_Dialog_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择您希望添加的新提供商和模型。现有的提供商、自定义端点、API 密钥和模型配置绝不会被删除或修改。`)
};

/**
* | output |
* | --- |
* | "Select the new providers and models you want to add. Existing providers, custom endpoints, API keys, and model configurations will never be deleted or modified." |
*
* @param {Sync_Providers_Dialog_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_dialog_description = /** @type {((inputs?: Sync_Providers_Dialog_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Dialog_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_dialog_description(inputs)
	return zh_sync_providers_dialog_description(inputs)
});