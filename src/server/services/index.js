module.exports = {
  eval: $ => eval(`(async () => {with ($) {${$.content}\n}})()`) 
};