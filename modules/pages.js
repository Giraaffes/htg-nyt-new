import { Module } from "../modules.js";
export const module = new Module();

import * as fs from "fs";


module.route("GET /", (req, res, next) => {
	res.render("./pages/front-page.ejs");
});

module.route("GET /*", (req, res, next) => {
	let filePath = `./pages${req.path}.ejs`;
	if (fs.existsSync(filePath)) {
		res.render(filePath);
	} else {
		next();
	}
});