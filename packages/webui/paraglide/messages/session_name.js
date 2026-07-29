/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_NameInputs */

const en_session_name = /** @type {(inputs: Session_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session Name`)
};

const zh_session_name = /** @type {(inputs: Session_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会话名称`)
};

/**
* | output |
* | --- |
* | "Session Name" |
*
* @param {Session_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_name = /** @type {((inputs?: Session_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_name(inputs)
	return zh_session_name(inputs)
});