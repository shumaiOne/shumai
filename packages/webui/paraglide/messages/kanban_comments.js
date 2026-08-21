/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Kanban_CommentsInputs */

const en_kanban_comments = /** @type {(inputs: Kanban_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Kanban Comments`)
};

const zh_kanban_comments = /** @type {(inputs: Kanban_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`看板评论`)
};

/**
* | output |
* | --- |
* | "Kanban Comments" |
*
* @param {Kanban_CommentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_comments = /** @type {((inputs?: Kanban_CommentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Kanban_CommentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban_comments(inputs)
	return zh_kanban_comments(inputs)
});