/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Passwords_Do_Not_MatchInputs */

const en_passwords_do_not_match = /** @type {(inputs: Passwords_Do_Not_MatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Passwords do not match`)
};

const zh_passwords_do_not_match = /** @type {(inputs: Passwords_Do_Not_MatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`两次输入的密码不一致`)
};

/**
* | output |
* | --- |
* | "Passwords do not match" |
*
* @param {Passwords_Do_Not_MatchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const passwords_do_not_match = /** @type {((inputs?: Passwords_Do_Not_MatchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Passwords_Do_Not_MatchInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_passwords_do_not_match(inputs)
	return zh_passwords_do_not_match(inputs)
});