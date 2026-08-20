/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Kanban_BoardInputs */

const en_kanban_board = /** @type {(inputs: Kanban_BoardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Kanban Board`)
};

const zh_kanban_board = /** @type {(inputs: Kanban_BoardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`看板`)
};

/**
* | output |
* | --- |
* | "Kanban Board" |
*
* @param {Kanban_BoardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_board = /** @type {((inputs?: Kanban_BoardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Kanban_BoardInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban_board(inputs)
	return zh_kanban_board(inputs)
});