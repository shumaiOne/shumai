/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Text_ContentInputs */

const en_text_content = /** @type {(inputs: Text_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Text Content`)
};

const zh_text_content = /** @type {(inputs: Text_ContentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文本内容`)
};

/**
* | output |
* | --- |
* | "Text Content" |
*
* @param {Text_ContentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const text_content = /** @type {((inputs?: Text_ContentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Text_ContentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_text_content(inputs)
	return zh_text_content(inputs)
});