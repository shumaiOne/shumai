/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Search_MembersInputs */

const en_quota_search_members = /** @type {(inputs: Quota_Search_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search members...`)
};

const zh_quota_search_members = /** @type {(inputs: Quota_Search_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索成员...`)
};

/**
* | output |
* | --- |
* | "Search members..." |
*
* @param {Quota_Search_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_search_members = /** @type {((inputs?: Quota_Search_MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Search_MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_search_members(inputs)
	return zh_quota_search_members(inputs)
});