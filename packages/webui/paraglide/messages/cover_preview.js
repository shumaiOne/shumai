/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cover_PreviewInputs */

const en_cover_preview = /** @type {(inputs: Cover_PreviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cover Preview`)
};

const zh_cover_preview = /** @type {(inputs: Cover_PreviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`封面预览`)
};

/**
* | output |
* | --- |
* | "Cover Preview" |
*
* @param {Cover_PreviewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cover_preview = /** @type {((inputs?: Cover_PreviewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cover_PreviewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cover_preview(inputs)
	return zh_cover_preview(inputs)
});