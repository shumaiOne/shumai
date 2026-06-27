/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Uploads_HintInputs */

const en_no_uploads_hint = /** @type {(inputs: No_Uploads_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload files in the project view to track progress here.`)
};

const zh_no_uploads_hint = /** @type {(inputs: No_Uploads_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`在项目视图中上传文件以在此处跟踪进度。`)
};

/**
* | output |
* | --- |
* | "Upload files in the project view to track progress here." |
*
* @param {No_Uploads_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_uploads_hint = /** @type {((inputs?: No_Uploads_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Uploads_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_uploads_hint(inputs)
	return zh_no_uploads_hint(inputs)
});