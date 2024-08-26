import { Module } from "../modules.js";
export const module = new Module();

import articleData from "../article_data.json" assert {type: "json"};


const pages = {
	"/": "home",
	"/page": "category-list"
};

module.route("GET /", (req, res) => {
	res.render("home");
});

module.route("GET /page", (req, res) => {
	res.render("category-list", {articles: articleData});
});

for (let [ path, page ] of Object.entries(pages)) {
	module.route({method: "GET", path}, (req, res, next) => {
		res.render(page);
	});
}