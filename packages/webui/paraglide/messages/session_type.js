/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_TypeInputs */

const en_session_type = /** @type {(inputs: Session_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session Type`)
};

const zh_session_type = /** @type {(inputs: Session_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会话类型`)
};

/**
* | output |
* | --- |
* | "Session Type" |
*
* @param {Session_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type = /** @type {((inputs?: Session_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_type(inputs)
	return zh_session_type(inputs)
});