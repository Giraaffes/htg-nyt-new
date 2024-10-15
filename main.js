// import { exec } from "child_process";
import { promisify } from "util";

import "express-async-errors";
import express from "express";

import cookieParser from "cookie-parser"; // Do I use this? (Do I need to use this?)


const server = express();
server.set("view engine", "ejs");
server.set("views", "./pages");
server.use(cookieParser());

import * as database from "./database.js";
import * as docs from "./docs.js";

import config from "./config.json" assert {type: "json"};
import googleCredentials from "./google-service-account.json" assert {type: "json"};


// Remember 799

// (1) Modules
import * as modules from "./modules.js";

await modules.register("pages");
await modules.register("editor");
await modules.register("login");

modules.useRoutes(server, database, docs);


// (2) GitHub webhook
// server.post("/github-push", (req, res) => {
// 	if (!req.headers["x-github-hook-id"] == config.githubWebhookId) return;
// 	res.status(200).end();

// 	exec("git pull", (error, stdout, stderr) => {
// 		console.log(stdout);
// 		process.exit();
// 	});
// });


// (3) Static files
server.use("/static", express.static("static", {
	extensions: ["html"],
	fallthrough: false
}));
server.use("/sass", express.static("sass"));


// (4) 404 and error handling
server.use((req, res, next) => {
	next(Object.assign(new Error(), {status: 404}))
});

server.use((err, req, res, next) => {
	if (err.status == 404) {
		res.status(404).send("<title>404</title>404: Denne side findes ikke").end();
	} else {
		let timeStr = (new Date()).toLocaleString({timeZone: "Europe/Copenhagen"});
		console.error(timeStr, req.url, err);
	
		res.status(500).send("<title>Fejl</title>Beklager, der opstod en fejl...").end();
	}
});


// (5) Main
let dbOptions = process.env.LOCAL ? config.dbRemoteOptions : config.dbOptions;
await database.connect(dbOptions);
console.log("Database connected");

await docs.connect(googleCredentials);
console.log("Docs connected");

let port = process.env.LOCAL ? 8889 : config.port;
await promisify(server.listen.bind(server))(port);
console.log("Server ready");

await modules.init(database, docs);
console.log(`Modules ready (${modules.count})`);