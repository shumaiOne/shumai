/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Uploads_YetInputs */

const en_no_uploads_yet = /** @type {(inputs: No_Uploads_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No uploads yet`)
};

const zh_no_uploads_yet = /** @type {(inputs: No_Uploads_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无上传`)
};

/**
* | output |
* | --- |
* | "No uploads yet" |
*
* @param {No_Uploads_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_uploads_yet = /** @type {((inputs?: No_Uploads_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Uploads_YetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_uploads_yet(inputs)
	return zh_no_uploads_yet(inputs)
});