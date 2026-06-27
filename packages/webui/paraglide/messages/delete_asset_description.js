/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Asset_DescriptionInputs */

const en_delete_asset_description = /** @type {(inputs: Delete_Asset_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deleted items can be recovered for 30 days before being permanently deleted.`)
};

const zh_delete_asset_description = /** @type {(inputs: Delete_Asset_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已删除的项目可在 30 天内恢复，之后将被永久删除。`)
};

/**
* | output |
* | --- |
* | "Deleted items can be recovered for 30 days before being permanently deleted." |
*
* @param {Delete_Asset_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_asset_description = /** @type {((inputs?: Delete_Asset_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Asset_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_asset_description(inputs)
	return zh_delete_asset_description(inputs)
});