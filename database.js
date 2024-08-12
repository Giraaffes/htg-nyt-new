import * as mySQL from "mysql2";

export let isConnected = false;
export let connection;


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

function mySQLFormat(value) {
	if (typeof value == "number" || typeof value == "boolean") {
		return value;
	} else if (value instanceof Array) { // Assumes string values
		if (value.length == 0) value = [null];
		return `(${value.map(mySQLFormat).join(", ")})`;
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
		return mySQLFormat(values[i]);
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
	for (let i = 0; i < values.length; i++) { // I think this is necessary
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