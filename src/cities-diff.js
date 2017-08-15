const promiseMysql = require('promise-mysql');
const csv = require('csv');
const fs = require('fs');
const _ = require('lodash');
const { promisify } = require('util');

require('dotenv').config();

const CSV_FILE_PATH = process.env.CSV_FILE_PATH;
const RESULT_FILE_PATH = process.env.RESULT_FILE_PATH;

const connection = promiseMysql.createConnection({
  host: process.env.HOST,
  user: process.env.USERNAME,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

const readFileAsync = promisify(fs.readFile);
const parseCsvAsync = promisify(csv.parse);
const results = {
  citiesDoesntExist: {},
};

const resultsFile = fs.createWriteStream(RESULT_FILE_PATH);

// Read CSV
readFileAsync(CSV_FILE_PATH)
  .then(parseCsv)
  .then(groupByState)
  .then(transformStateGroup)
  .then(statesSearch)
  .then(formatResultsFile)
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
      const sql = `SELECT id, nome FROM ESTADO WHERE nome LIKE "%${state}%" AND country_code = "BO" LIMIT 1`;
      return con.query(sql);
    })
      .then((result) => {
        if (!result.length) return result;
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
      const sql = `SELECT * FROM CIDADE WHERE id_estado = ${stateId} AND nome = "${city}"`;
      const query = con.query(sql);
      return query;
    })
      .then((result) => {
        if (!result.length) {
          writeCityDoesntExist(stateId, stateName, city);
          return;
        }
        return result;
      })
      .catch(error => console.error(error));
  });

  return Promise.all(promises);
}

function writeCityDoesntExist(stateId, stateName, city) {
  const citiesDoesntExist = results.citiesDoesntExist[`${stateId} - ${stateName}`];
  if (citiesDoesntExist) results.citiesDoesntExist[`${stateId} - ${stateName}`].cities = _.concat(citiesDoesntExist.cities, [city]);
  else {
    results.citiesDoesntExist[`${stateId} - ${stateName}`] = {
      stateId,
      stateName,
      cities: [city],
    };
  }
}

function formatResultsFile() {
  resultsFile.write(JSON.stringify(results, null, 2));
}
