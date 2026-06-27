/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Already_Have_AccountInputs */

const en_already_have_account = /** @type {(inputs: Already_Have_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Already have an account? `)
};

const zh_already_have_account = /** @type {(inputs: Already_Have_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已有账户？`)
};

/**
* | output |
* | --- |
* | "Already have an account?" |
*
* @param {Already_Have_AccountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const already_have_account = /** @type {((inputs?: Already_Have_AccountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Already_Have_AccountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_already_have_account(inputs)
	return zh_already_have_account(inputs)
});