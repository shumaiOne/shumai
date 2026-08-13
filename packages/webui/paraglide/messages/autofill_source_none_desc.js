/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_None_DescInputs */

const en_autofill_source_none_desc = /** @type {(inputs: Autofill_Source_None_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Metadata fields marked as 'None' will not be automatically populated by AI. They are meant for manual user entry.`)
};

const zh_autofill_source_none_desc = /** @type {(inputs: Autofill_Source_None_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置为“无”的字段不会由 AI 自动填充，需由用户手动填写。`)
};

/**
* | output |
* | --- |
* | "Metadata fields marked as 'None' will not be automatically populated by AI. They are meant for manual user entry." |
*
* @param {Autofill_Source_None_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_none_desc = /** @type {((inputs?: Autofill_Source_None_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_None_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_none_desc(inputs)
	return zh_autofill_source_none_desc(inputs)
});