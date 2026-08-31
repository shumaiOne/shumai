/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AttachmentsInputs */

const en_attachments = /** @type {(inputs: AttachmentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Attachments`)
};

const zh_attachments = /** @type {(inputs: AttachmentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`附件`)
};

/**
* | output |
* | --- |
* | "Attachments" |
*
* @param {AttachmentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const attachments = /** @type {((inputs?: AttachmentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AttachmentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_attachments(inputs)
	return zh_attachments(inputs)
});