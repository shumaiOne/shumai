/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_SourceInputs */

const en_autofill_source = /** @type {(inputs: Autofill_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Autofill Source`)
};

const zh_autofill_source = /** @type {(inputs: Autofill_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自动填充来源`)
};

/**
* | output |
* | --- |
* | "Autofill Source" |
*
* @param {Autofill_SourceInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source = /** @type {((inputs?: Autofill_SourceInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_SourceInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source(inputs)
	return zh_autofill_source(inputs)
});