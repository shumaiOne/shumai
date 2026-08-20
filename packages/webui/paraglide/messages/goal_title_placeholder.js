/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_Title_PlaceholderInputs */

const en_goal_title_placeholder = /** @type {(inputs: Goal_Title_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g. Q3 Launch Deliverables`)
};

const zh_goal_title_placeholder = /** @type {(inputs: Goal_Title_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如：Q3 发布交付物`)
};

/**
* | output |
* | --- |
* | "e.g. Q3 Launch Deliverables" |
*
* @param {Goal_Title_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_title_placeholder = /** @type {((inputs?: Goal_Title_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_Title_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_title_placeholder(inputs)
	return zh_goal_title_placeholder(inputs)
});