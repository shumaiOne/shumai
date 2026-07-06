/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Collection_ConfirmInputs */

const en_delete_collection_confirm = /** @type {(inputs: Delete_Collection_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Collection?`)
};

const zh_delete_collection_confirm = /** @type {(inputs: Delete_Collection_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除媒体合集？`)
};

/**
* | output |
* | --- |
* | "Delete Collection?" |
*
* @param {Delete_Collection_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_collection_confirm = /** @type {((inputs?: Delete_Collection_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Collection_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_collection_confirm(inputs)
	return zh_delete_collection_confirm(inputs)
});