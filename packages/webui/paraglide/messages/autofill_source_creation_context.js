/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_Creation_ContextInputs */

const en_autofill_source_creation_context = /** @type {(inputs: Autofill_Source_Creation_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Creation Context`)
};

const zh_autofill_source_creation_context = /** @type {(inputs: Autofill_Source_Creation_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建上下文`)
};

/**
* | output |
* | --- |
* | "Creation Context" |
*
* @param {Autofill_Source_Creation_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_creation_context = /** @type {((inputs?: Autofill_Source_Creation_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_Creation_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_creation_context(inputs)
	return zh_autofill_source_creation_context(inputs)
});