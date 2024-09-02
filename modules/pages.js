import { Module } from "#root/modules.js";
export const module = new Module();


import articleData from "../article_data.json" assert {type: "json"};

module.route("GET /", (req, res, next, render) => {
	render("home");
});

module.route("GET /page", (req, res, next, render) => {
	render("category-list", {articles: articleData});
});