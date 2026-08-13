/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_Help_DescInputs */

const en_autofill_source_help_desc = /** @type {(inputs: Autofill_Source_Help_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Understand how each autofill source option works and when to use it.`)
};

const zh_autofill_source_help_desc = /** @type {(inputs: Autofill_Source_Help_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`了解每种自动填充来源的工作方式及适用场景。`)
};

/**
* | output |
* | --- |
* | "Understand how each autofill source option works and when to use it." |
*
* @param {Autofill_Source_Help_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_help_desc = /** @type {((inputs?: Autofill_Source_Help_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_Help_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_help_desc(inputs)
	return zh_autofill_source_help_desc(inputs)
});