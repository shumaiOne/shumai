/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Markup_Not_Supported_For_This_FileInputs */

const en_markup_not_supported_for_this_file = /** @type {(inputs: Markup_Not_Supported_For_This_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Markup is not supported for this file type`)
};

const zh_markup_not_supported_for_this_file = /** @type {(inputs: Markup_Not_Supported_For_This_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此文件类型不支持标注`)
};

/**
* | output |
* | --- |
* | "Markup is not supported for this file type" |
*
* @param {Markup_Not_Supported_For_This_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const markup_not_supported_for_this_file = /** @type {((inputs?: Markup_Not_Supported_For_This_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Markup_Not_Supported_For_This_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_markup_not_supported_for_this_file(inputs)
	return zh_markup_not_supported_for_this_file(inputs)
});