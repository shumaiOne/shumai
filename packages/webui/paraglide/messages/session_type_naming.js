/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_Type_NamingInputs */

const en_session_type_naming = /** @type {(inputs: Session_Type_NamingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Naming`)
};

const zh_session_type_naming = /** @type {(inputs: Session_Type_NamingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`命名`)
};

/**
* | output |
* | --- |
* | "Naming" |
*
* @param {Session_Type_NamingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type_naming = /** @type {((inputs?: Session_Type_NamingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_Type_NamingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_type_naming(inputs)
	return zh_session_type_naming(inputs)
});