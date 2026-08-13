/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_Content_ExampleInputs */

const en_autofill_source_content_example = /** @type {(inputs: Autofill_Source_Content_ExampleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Example: Image subject category, visual color palette, document summary, auto-detected language.`)
};

const zh_autofill_source_content_example = /** @type {(inputs: Autofill_Source_Content_ExampleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`示例：图片类别、主色调、文档摘要、自动识别语言。`)
};

/**
* | output |
* | --- |
* | "Example: Image subject category, visual color palette, document summary, auto-detected language." |
*
* @param {Autofill_Source_Content_ExampleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content_example = /** @type {((inputs?: Autofill_Source_Content_ExampleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_Content_ExampleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_content_example(inputs)
	return zh_autofill_source_content_example(inputs)
});