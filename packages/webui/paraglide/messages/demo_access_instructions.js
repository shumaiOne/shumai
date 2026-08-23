/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Access_InstructionsInputs */

const en_demo_access_instructions = /** @type {(inputs: Demo_Access_InstructionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Use "foo@bar.com" as the email and "foo" as the password to login (this demo account is read-only).`)
};

const zh_demo_access_instructions = /** @type {(inputs: Demo_Access_InstructionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用 "foo@bar.com" 作为邮箱，"foo" 作为密码登录（该演示账户为只读）。`)
};

/**
* | output |
* | --- |
* | "Use \"foo@bar.com\" as the email and \"foo\" as the password to login (this demo account is read-only)." |
*
* @param {Demo_Access_InstructionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const demo_access_instructions = /** @type {((inputs?: Demo_Access_InstructionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Access_InstructionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_access_instructions(inputs)
	return zh_demo_access_instructions(inputs)
});