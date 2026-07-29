/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SessionsInputs */

const en_sessions = /** @type {(inputs: SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sessions`)
};

const zh_sessions = /** @type {(inputs: SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会话列表`)
};

/**
* | output |
* | --- |
* | "Sessions" |
*
* @param {SessionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sessions = /** @type {((inputs?: SessionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SessionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sessions(inputs)
	return zh_sessions(inputs)
});