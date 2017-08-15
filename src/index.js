const promiseMysql = require('promise-mysql');
const csv = require('csv');
const fs = require('fs');
const _ = require('lodash');
const { promisify } = require('util');

require('dotenv').config();

const CSV_FILE_PATH = process.env.CSV_FILE_PATH;
const RESULT_FILE_PATH = process.env.RESULT_FILE_PATH;
const SQL_FILE_PATH = process.env.SQL_FILE_PATH;
const COUNTRY_CODE = process.env.COUNTRY_INITIAL;

const connection = promiseMysql.createConnection({
  host: process.env.HOST,
  user: process.env.USERNAME,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  port: process.env.PORT,
});

const readFileAsync = promisify(fs.readFile);
const parseCsvAsync = promisify(csv.parse);
const results = {
  statesToAdd: {},
  statesToEdit: [],
  citiesToAdd: {},
  citiesToEdit: {},
};

const resultsFile = fs.createWriteStream(RESULT_FILE_PATH);
const sqlFile = fs.createWriteStream(SQL_FILE_PATH);

// Read CSV
readFileAsync(CSV_FILE_PATH)
  .then(parseCsv)
  .then(groupByState)
  .then(transformStateGroup)
  .then(statesSearch)
  .then(formatResultsFile)
  .then(writeSqlFile)
  .then(() => connection.then(con => con.end()))
  .catch((err) => {
    console.error(err);
  });

// Parse CSV
function parseCsv(content) {
  return parseCsvAsync(content, { columns: ['estado', 'capital', 'provicia', 'cidade'] });
}

// Categorize results by state
function groupByState(csvContent) {
  return _.groupBy(_.drop(csvContent), 'estado');
}

// Transform stateGroup to return only the cities by state
function transformStateGroup(content) {
  const result = {};
  _.forEach(content, (cities, state) => {
    result[state] = _.map(cities, city => city.cidade);
  });
  return result;
}

// Search through all states and find if cities exists
function statesSearch(states) {
  const promises = _.map(states, (cities, state) => {
    return connection.then((con) => {
      const sql = `SELECT id, nome FROM ESTADO WHERE nome LIKE "%${state}%" AND country_code = "${COUNTRY_CODE}" LIMIT 1`;
      return con.query(sql);
    })
      .then((result) => {
        if (!result.length) {
          writeAddState(state, cities);
          return result;
        }

        if (result[0].nome !== state) {
          writeEditState(result[0].id, result[0].nome, state);
        }
        return citySearch(result[0].id, state, cities);
      })
      .catch(error => console.error(error));
  });
  return Promise.all(promises);
}

// Search through all cities and find when it needs to be added and when it needs to be updated
function citySearch(stateId, stateName, cities) {
  const promises = _.map(cities, (city) => {
    return connection.then((con) => {
      const sql = `SELECT * FROM CIDADE WHERE id_estado = ${stateId} AND nome LIKE "%${city}%"`;
      const query = con.query(sql);
      return query;
    })
      .then((result) => {
        if (!result.length) {
          writeAddCity(stateId, stateName, city);
          return;
        }

        if (result[0].nome !== city) {
          writeEditCity(stateId, stateName, result[0].id, result[0].nome, city);
        }
        return result;
      })
      .catch(error => console.error(error));
  });

  return Promise.all(promises);
}

function writeAddState(state, cities) {
  results.statesToAdd[state] = cities;
}

function writeEditState(id, oldStateName, newStateName) {
  results.statesToEdit.push({ id, oldStateName, newStateName });
}

function writeAddCity(stateId, stateName, city) {
  const citiesToAdd = results.citiesToAdd[`${stateId} - ${stateName}`];
  if (citiesToAdd) results.citiesToAdd[`${stateId} - ${stateName}`].cities = _.concat(citiesToAdd.cities, [city]);
  else {
    results.citiesToAdd[`${stateId} - ${stateName}`] = {
      stateId,
      stateName,
      cities: [city],
    };
  }
}

function writeEditCity(stateId, stateName, cityId, oldCityName, newCityName) {
  const citiesToEdit = results.citiesToEdit[`${stateId} - ${stateName}`];
  if (citiesToEdit) results.citiesToEdit[`${stateId} - ${stateName}`].cities.push({ id: cityId, name: newCityName, oldName: oldCityName });
  else {
    results.citiesToEdit[`${stateId} - ${stateName}`] = {
      stateId,
      stateName,
      cities: [
        { id: cityId, name: newCityName, oldName: oldCityName },
      ],
    };
  }
}

function formatResultsFile() {
  resultsFile.write(JSON.stringify(results, null, 2));
}

function writeSqlFile() {
  sqlFile.write('-- EDITAR ESTADOS\n');
  _.forEach(results.statesToEdit, (state) => {
    sqlFile.write(`UPDATE ESTADO SET nome = "${state.newStateName}" WHERE nome = "${state.oldStateName}" AND country_code = "BO";`);
  });

  sqlFile.write('\n\n-- ADICIONAR CIDADES\n');
  _.forEach(results.citiesToAdd, (data) => {
    _.forEach(data.cities, (city) => {
      const sql = `INSERT INTO CIDADE(id_estado,nome) SELECT * FROM (SELECT ${data.stateId},"${city}") AS tmp WHERE NOT EXISTS (SELECT nome FROM CIDADE WHERE nome = "${city}" AND id_estado=${data.stateId}) LIMIT 1;\n\n`;
      sqlFile.write(sql);
    });
  });

  sqlFile.write('\n\n-- EDITAR CIDADES\n');
  _.forEach(results.citiesToEdit, (data) => {
    _.forEach(data.cities, (city) => {
      sqlFile.write(`UPDATE CIDADE SET nome = "${city.name}" WHERE id_estado = ${data.stateId} AND nome = "${city.oldName}";\n\n`);
    });
  });
}
