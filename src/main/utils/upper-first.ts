/**
 * Converts the first character of `string` to upper case.
 *
 * @category String
 * @param {string} [string=''] The string to convert.
 * @returns {string} Returns the converted string.
 * @see camelCase, kebabCase, lowerCase, pascalCase, snakeCase, startCase, upperCase
 * @example
 *
 * upperFirst('fred')
 * // => 'Fred'
 *
 * upperFirst('FRED')
 * // => 'FRED'
 */
const upperFirst = (string: string): string => {
  if (!string) {
    return "";
  }

  const chr = string[0];

  const trailing = string.slice(1);

  return chr.toUpperCase() + trailing;
};

export default upperFirst;
