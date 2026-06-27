/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} PasswordInputs */

const en_password = /** @type {(inputs: PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Password`)
};

const zh_password = /** @type {(inputs: PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`密码`)
};

/**
* | output |
* | --- |
* | "Password" |
*
* @param {PasswordInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password = /** @type {((inputs?: PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<PasswordInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password(inputs)
	return zh_password(inputs)
});