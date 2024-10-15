import * as mySQL from "mysql2";

export let isConnected = false;
export let connection;


// Why do I have both query() and execute()?
// Well, I need array placeholders (for IN statements), but they need to be formatted manually.
// This would defeat the purpose of using execute() for performance,
// and it would (principially) make execute() unsecure.


export function connect(options) {
	return new Promise((res, rej) => {
		connection = mySQL.createConnection(options);
		connection.connect((err) => {
			if (err) {
				rej(err);
			} else {
				isConnected = true;
				res();
			}
		});
	});
};

function formatMySQL(value) {
	if (typeof value == "number" || typeof value == "boolean") {
		return value;
	} else if (value instanceof Array) { // Assumes string values
		if (value.length == 0) value = [null];
		return `(${value.map(formatMySQL).join(", ")})`;
	} else if (!value) {
		return "NULL";
	} else {
		return `"${value.toString().replaceAll("\"", "\\\"")}"`;
	}
}

export function query(query, values) {
	let i = -1;
	query = query.replaceAll("?", () => {
		i++;
		return formatMySQL(values[i]);
	});

	return new Promise((res, rej) => {
		connection.query(query, (err, results, fields) => {
			if (err) {
				rej(err);
			} else {
				res(results);
			}
		});
	});
}

export function execute(query, values) {
	for (let i = 0; i < values.length; i++) { // I think this is necessary but I'm not sure
		if (values[i] === undefined) values[i] = null;
	}

	return new Promise((res, rej) => {
		connection.query(query, values, (err, results, fields) => {
			if (err) {
				rej(err);
			} else {
				res(results);
			}
		});
	});
}