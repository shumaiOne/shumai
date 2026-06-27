/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_AccountInputs */

const en_create_account = /** @type {(inputs: Create_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Account`)
};

const zh_create_account = /** @type {(inputs: Create_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建账户`)
};

/**
* | output |
* | --- |
* | "Create Account" |
*
* @param {Create_AccountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_account = /** @type {((inputs?: Create_AccountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_AccountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_account(inputs)
	return zh_create_account(inputs)
});