/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Members_ViewInputs */

const en_members_view = /** @type {(inputs: Members_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Members`)
};

const zh_members_view = /** @type {(inputs: Members_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`成员`)
};

/**
* | output |
* | --- |
* | "Members" |
*
* @param {Members_ViewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const members_view = /** @type {((inputs?: Members_ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Members_ViewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_members_view(inputs)
	return zh_members_view(inputs)
});