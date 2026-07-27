/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_Name_And_PathInputs */

const en_copy_name_and_path = /** @type {(inputs: Copy_Name_And_PathInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copy name and path`)
};

const zh_copy_name_and_path = /** @type {(inputs: Copy_Name_And_PathInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`复制名称和路径`)
};

/**
* | output |
* | --- |
* | "Copy name and path" |
*
* @param {Copy_Name_And_PathInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_name_and_path = /** @type {((inputs?: Copy_Name_And_PathInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_Name_And_PathInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copy_name_and_path(inputs)
	return zh_copy_name_and_path(inputs)
});