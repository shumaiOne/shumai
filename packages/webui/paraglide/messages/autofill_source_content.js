/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_ContentInputs */

const en_autofill_source_content = /** @type {(inputs: Autofill_Source_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Content`)
};

const zh_autofill_source_content = /** @type {(inputs: Autofill_Source_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文件内容`)
};

/**
* | output |
* | --- |
* | "Content" |
*
* @param {Autofill_Source_ContentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content = /** @type {((inputs?: Autofill_Source_ContentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_ContentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_content(inputs)
	return zh_autofill_source_content(inputs)
});