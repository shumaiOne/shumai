/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Quota_ConfirmInputs */

const en_delete_quota_confirm = /** @type {(inputs: Delete_Quota_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete this quota rule? This action cannot be undone.`)
};

const zh_delete_quota_confirm = /** @type {(inputs: Delete_Quota_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确定要删除此配额规则吗？此操作无法撤销。`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete this quota rule? This action cannot be undone." |
*
* @param {Delete_Quota_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_quota_confirm = /** @type {((inputs?: Delete_Quota_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Quota_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_quota_confirm(inputs)
	return zh_delete_quota_confirm(inputs)
});