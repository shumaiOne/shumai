/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unnamed_SessionInputs */

const en_unnamed_session = /** @type {(inputs: Unnamed_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unnamed Session`)
};

const zh_unnamed_session = /** @type {(inputs: Unnamed_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未命名会话`)
};

/**
* | output |
* | --- |
* | "Unnamed Session" |
*
* @param {Unnamed_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unnamed_session = /** @type {((inputs?: Unnamed_SessionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unnamed_SessionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unnamed_session(inputs)
	return zh_unnamed_session(inputs)
});