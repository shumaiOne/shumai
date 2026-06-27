/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Password_Is_RequiredInputs */

const en_password_is_required = /** @type {(inputs: Password_Is_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Password is required`)
};

const zh_password_is_required = /** @type {(inputs: Password_Is_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`密码为必填项`)
};

/**
* | output |
* | --- |
* | "Password is required" |
*
* @param {Password_Is_RequiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_is_required = /** @type {((inputs?: Password_Is_RequiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Password_Is_RequiredInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password_is_required(inputs)
	return zh_password_is_required(inputs)
});