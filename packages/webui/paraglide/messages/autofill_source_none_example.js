/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_Source_None_ExampleInputs */

const en_autofill_source_none_example = /** @type {(inputs: Autofill_Source_None_ExampleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Example: Internal tags, manual notes, status tracking flags.`)
};

const zh_autofill_source_none_example = /** @type {(inputs: Autofill_Source_None_ExampleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`示例：内部标签、手动备注、状态标记。`)
};

/**
* | output |
* | --- |
* | "Example: Internal tags, manual notes, status tracking flags." |
*
* @param {Autofill_Source_None_ExampleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_none_example = /** @type {((inputs?: Autofill_Source_None_ExampleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_Source_None_ExampleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_source_none_example(inputs)
	return zh_autofill_source_none_example(inputs)
});