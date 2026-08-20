/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Run_StatusInputs */

const en_run_status = /** @type {(inputs: Run_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Run Status`)
};

const zh_run_status = /** @type {(inputs: Run_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`运行状态`)
};

/**
* | output |
* | --- |
* | "Run Status" |
*
* @param {Run_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_status = /** @type {((inputs?: Run_StatusInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Run_StatusInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_run_status(inputs)
	return zh_run_status(inputs)
});