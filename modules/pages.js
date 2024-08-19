import { Module } from "../modules.js";
export const module = new Module();


const pages = {
	"/": "home",
	"/page": "category-list"
};


import fs from "fs";
for (let [ path, page ] of Object.entries(pages)) {
	module.route({method: "GET", path}, (req, res, next) => {
		res.render(page, /*(err, html) => {
			fs.writeFileSync("./html.txt", html);
		}*/);
	});
}