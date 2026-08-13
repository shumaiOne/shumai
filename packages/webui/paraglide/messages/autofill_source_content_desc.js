/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_Content_DescInputs */

const en_autofill_source_content_desc = /** @type {(inputs: Autofill_Source_Content_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fields marked as 'Content' are automatically analyzed and extracted from the asset's visual or textual content after upload. Note: A team owner must first create and enable an Autofill Agent in team settings for content extraction to run.`)
};

const zh_autofill_source_content_desc = /** @type {(inputs: Autofill_Source_Content_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置为“文件内容”的字段将在文件上传后，由 AI 自动分析并从文件的视觉或文本内容中提取填写。注意：需要团队 Owner 先在设置中创建并启用“Autofill Agent”（自动填充 Agent），上传后才会触发内容提取。`)
};

/**
* | output |
* | --- |
* | "Fields marked as 'Content' are automatically analyzed and extracted from the asset's visual or textual content after upload. Note: A team owner must first cr..." |
*
* @param {Autofill_Source_Content_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content_desc = /** @type {((inputs?: Autofill_Source_Content_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_Content_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_content_desc(inputs)
	return zh_autofill_source_content_desc(inputs)
});