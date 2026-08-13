/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_Creation_Context_DescInputs */

const en_autofill_source_creation_context_desc = /** @type {(inputs: Autofill_Source_Creation_Context_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fields marked as 'Creation Context' capture details available at creation time (such as generation prompt, model, or provider). If an asset is created by a Shumai AI Agent, the agent will automatically populate these fields upon creation (without needing an Autofill Agent enabled). If uploaded manually by a human user, the user must enter these values manually.`)
};

const zh_autofill_source_creation_context_desc = /** @type {(inputs: Autofill_Source_Creation_Context_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置为“创建上下文”的字段用于记录生成资产时的上下文信息（如 Prompt、模型或供应商）。若文件由 Shumai AI Agent 生成/创建，Agent 会在创建时刻自动填入这些字段（无需启用 Autofill Agent）；若由真实用户手动上传，则需用户手动填写，不会自动提取。`)
};

/**
* | output |
* | --- |
* | "Fields marked as 'Creation Context' capture details available at creation time (such as generation prompt, model, or provider). If an asset is created by a S..." |
*
* @param {Autofill_Source_Creation_Context_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_creation_context_desc = /** @type {((inputs?: Autofill_Source_Creation_Context_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_Creation_Context_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_creation_context_desc(inputs)
	return zh_autofill_source_creation_context_desc(inputs)
});