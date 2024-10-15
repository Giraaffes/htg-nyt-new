import { Module } from "#root/modules.js";
export const module = new Module();


// (R) Article listings

import articlesData from "../article_data.json" assert {type: "json"};

module.route("GET /", (req, res, next, render) => {
	render("home");
});

module.route("GET /page", (req, res, next, render) => {
	render("category-list", {articles: articlesData});
});


// (O) Article view

// todo escape html generally
// todo support empty lines

function parseDocColor(clr) {
	let { red: r, green: g, blue: b} = clr.color.rgbColor;
	let rHex = Math.floor(r * 255).toString(16).padStart(2, "0");
	let gHex = Math.floor(g * 255).toString(16).padStart(2, "0");
	let bHex = Math.floor(b * 255).toString(16).padStart(2, "0");
	return `#${rHex}${gHex}${bHex}`;
}

// todo formatting and parsing text alignment
function parseDocText(doc, element) {
	let text = element.textRun.content;
	text = text.replaceAll("\n", "");
	if (!text) return null;

	let style = element.textRun.textStyle;
	return {
		text,
		bold: style.bold || false,
		italic: style.italic || false,
		underline: style.underline || false,
		strikethrough: style.strikethrough || false,
		color: style.foregroundColor ? parseDocColor(style.foregroundColor) : null,
		link: style.link ? style.link.url : null,
	};
}

function parseDocImage(doc, element) {
	let inlineObject = doc.inlineObjects[element.inlineObjectElement.inlineObjectId];
	let embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
	let img = embeddedObject.imageProperties;
	if (!img) return null;

	return {
		url: img.contentUri,
		desc: null
	};
}

const imgDescRegex = /^\((.+)\)$/;
const questionAnswerRegex = /^\[(.+?)(?:\((.+?)\))?:(.*)\]$/;
const quoteRegex = /^\["(.+)"\]$/;

const questionWords = ["spørgsmål", "spørsmål", "spsm", "spsm.", "spm", "spm.", "sp", "sp.", "qst", "qst.", "q"];
const answerWords = ["svar", "svr", "sv", "sv.", "ans", "ans.", "a"];

function parseArticleDoc(doc) {
	// Note: difference between doc elements / article elements

	let docParagraphs = doc.content.filter(se => se.paragraph);
	let docElementGroups = docParagraphs.flatMap(dp => dp.paragraph.elements.reduce((dpElementGroups, dpElement) => {
		let isHeading = dp.paragraph.paragraphStyle.namedStyleType.startsWith("HEADING");

		let type, element;
		if (dpElement.textRun && !isHeading) {
			type = "text";
		} else if (dpElement.textRun && isHeading) {
			type = "heading";
		} else if (dpElement.inlineObjectElement) {
			type = "image";
		} else { return dpElementGroups; }
		
		let lastDpElementGroup = dpElementGroups.slice(-1)[0];
		if (lastDpElementGroup && lastDpElementGroup.type == type) {
			lastDpElementGroup.elements.push(dpElement);
		} else {
			dpElementGroups.push({type, elements: [dpElement]});
		}

		return dpElementGroups;
	}, []));

	let atcElements = docElementGroups.flatMap(({ type, elements }) => {
		let textParts;
		if (type == "text" || type == "heading") {
			textParts = elements.map(e => parseDocText(doc, e)).filter(e => e);
		}

		if (type == "text" && textParts.length > 0) {
			return [{type, parts: textParts}];
		} else if (type == "heading" && textParts.length > 0) {
			return [{type, text: textParts.map(p => p.text).join("")}];
		} else if (type == "image") {
			return elements.map(e => ({type: "image", ...parseDocImage(doc, e)}));
		} else { return []; }
	});

	for (let i in atcElements) {
		let e = atcElements[i];
		if (e.type != "text") continue;

		let isUnderImage = ((atcElements[i - 1] || {}).type == "image");
		let imgDescMatch = e.parts.map(p => p.text).join("").match(imgDescRegex);
		if (isUnderImage && imgDescMatch) {
			atcElements[i - 1].desc = imgDescMatch[1];
			atcElements[i] = null;
		}
	}
	atcElements = atcElements.filter(e => e);

	// todo formatted text inside special elements? (can use regex /d flag)
	for (let i in atcElements) {
		let e = atcElements[i];
		if (e.type != "text") continue;

		let text = e.parts.map(p => p.text).join("");
		let match;
		if (match = text.match(questionAnswerRegex)) {
			let type;
			let word = match[1].trim().toLowerCase();
			if (questionWords.includes(word)) {
				type = "question";
			} else if (answerWords.includes(word)) {
				type = "answer";
			} else { continue; }

			atcElements[i] = {type, 
				person: match[2] ? match[2].trim() : null, 
				text: match[3].trim()
			};
		} else if (match = text.match(quoteRegex)) {
			atcElements[i] = {type: "quote", text: match[1].trim()};
		}
	}

	return atcElements;
}

module.route("GET /article/:id", async (req, res, next, render, database, docs) => {
	let article = (await database.execute(
		`SELECT * FROM htgnyt2.articles WHERE id = ?;`, [req.params.id]
	))[0];

	let doc = await docs.getDocument(article.docsId);
	let content = parseArticleDoc(doc);

	render("article", {
		heading: article.heading, 
		subheading: article.subheading, 
		content
	});
});