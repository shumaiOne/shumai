/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ modelId: NonNullable<unknown>, provider: NonNullable<unknown> }} Remove_Model_PromptInputs */

const en_remove_model_prompt = /** @type {(inputs: Remove_Model_PromptInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Remove model ${i?.modelId} (${i?.provider}) from enabled models?`)
};

const zh_remove_model_prompt = /** @type {(inputs: Remove_Model_PromptInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`确定要从已启用模型中移除模型 ${i?.modelId}（${i?.provider}）吗？`)
};

/**
* | output |
* | --- |
* | "Remove model {modelId} ({provider}) from enabled models?" |
*
* @param {Remove_Model_PromptInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_model_prompt = /** @type {((inputs: Remove_Model_PromptInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_Model_PromptInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_remove_model_prompt(inputs)
	return zh_remove_model_prompt(inputs)
});