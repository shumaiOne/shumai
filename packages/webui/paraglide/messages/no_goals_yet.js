/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Goals_YetInputs */

const en_no_goals_yet = /** @type {(inputs: No_Goals_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No goals yet`)
};

const zh_no_goals_yet = /** @type {(inputs: No_Goals_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无目标`)
};

/**
* | output |
* | --- |
* | "No goals yet" |
*
* @param {No_Goals_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_goals_yet = /** @type {((inputs?: No_Goals_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Goals_YetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_goals_yet(inputs)
	return zh_no_goals_yet(inputs)
});