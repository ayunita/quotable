/**
 * Convert string or number value to boolean
 * @example
 * toBoolean(true)    // => true
 * toBoolean("true")  // => true
 * toBoolean("1")     // => true
 * toBoolean(1)       // => true
 *
 * toBoolean(false)   // => false
 * toBoolean("false") // => false
 * toBoolean(0)       // => false
 * toBoolean("0")     // => false
 */
module.exports = function toBoolean(value) {
  const number = parseInt(value)
  const string = String(value)
  return number ? Boolean(number) : String(string).toLowerCase() === 'true'
}
