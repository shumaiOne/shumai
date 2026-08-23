/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_DoneInputs */

const en_status_done = /** @type {(inputs: Status_DoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Done`)
};

const zh_status_done = /** @type {(inputs: Status_DoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已完成`)
};

/**
* | output |
* | --- |
* | "Done" |
*
* @param {Status_DoneInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_done = /** @type {((inputs?: Status_DoneInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_DoneInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_done(inputs)
	return zh_status_done(inputs)
});