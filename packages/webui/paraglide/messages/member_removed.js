/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Member_RemovedInputs */

const en_member_removed = /** @type {(inputs: Member_RemovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Member removed`)
};

const zh_member_removed = /** @type {(inputs: Member_RemovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`成员已移除`)
};

/**
* | output |
* | --- |
* | "Member removed" |
*
* @param {Member_RemovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const member_removed = /** @type {((inputs?: Member_RemovedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Member_RemovedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_member_removed(inputs)
	return zh_member_removed(inputs)
});