/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_Cover_HintInputs */

const en_upload_cover_hint = /** @type {(inputs: Upload_Cover_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drag and drop, or browse. Recommended 1:1 (400×400px).`)
};

const zh_upload_cover_hint = /** @type {(inputs: Upload_Cover_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`拖放或浏览文件。推荐比例 1:1（400×400像素）。`)
};

/**
* | output |
* | --- |
* | "Drag and drop, or browse. Recommended 1:1 (400×400px)." |
*
* @param {Upload_Cover_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_cover_hint = /** @type {((inputs?: Upload_Cover_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_Cover_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_cover_hint(inputs)
	return zh_upload_cover_hint(inputs)
});