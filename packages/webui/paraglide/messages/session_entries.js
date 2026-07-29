/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_EntriesInputs */

const en_session_entries = /** @type {(inputs: Session_EntriesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session Entries`)
};

const zh_session_entries = /** @type {(inputs: Session_EntriesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会话条目`)
};

/**
* | output |
* | --- |
* | "Session Entries" |
*
* @param {Session_EntriesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_entries = /** @type {((inputs?: Session_EntriesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_EntriesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_entries(inputs)
	return zh_session_entries(inputs)
});