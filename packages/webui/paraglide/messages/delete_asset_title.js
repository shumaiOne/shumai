/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Asset_TitleInputs */

const en_delete_asset_title = /** @type {(inputs: Delete_Asset_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Asset?`)
};

const zh_delete_asset_title = /** @type {(inputs: Delete_Asset_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除资源？`)
};

/**
* | output |
* | --- |
* | "Delete Asset?" |
*
* @param {Delete_Asset_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_asset_title = /** @type {((inputs?: Delete_Asset_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Asset_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_asset_title(inputs)
	return zh_delete_asset_title(inputs)
});