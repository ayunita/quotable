const lowerCase = require('lodash/lowerCase')
const clamp = require('lodash/clamp')
const createError = require('http-errors')
const Quote = require('../../models/Quotes')

/**
 * Search for quotes by content, author, and tags.
 *
 * ### Features
 * - Search multiple fields simultaneously, or limit the search to a single
 *   field for more targeted searches. By default, the method will search
 *   in `content` and `author`.
 * - Search results are sorted based on text matching score (how well they
 *   match the search terms)
 *
 * Full text Search:
 * By default, this method will use full text search.
 * @see https://docs.atlas.mongodb.com/reference/atlas-search/text/
 *
 * Exact Phrase Search:
 * If the `query` is wrapped in quotes, this method will use the `$phrase`
 * operator to search for an exact phrase. This will only return documents
 * where the specified field contains **all** of the search terms in order.
 * @see https://docs.atlas.mongodb.com/reference/atlas-search/phrase/
 *
 *
 * @param {Object} req
 * @param {Object} req.query
 * @param {string} req.query.query The search query. The query can be wrapped in
 *     quotes to search for an exact phrase.
 * @param {string} [req.query.path = 'content,author'] The field(s) to search
 *     in. The value should be a comma separated list of fields. Supported
 *     fields 'content' | 'author' | 'tags'
 * @param {string} [req.query.slop = 0] When searching for an exact phrase,
 *     this controls how much flexibility is allowed in the order of the search
 *     terms. See mongodb docs.
 */
module.exports = async function searchQuotes(req, res, next) {
  try {
    let {
      query,
      path = 'content,author',
      slop = 0,
      limit = 20,
      skip = 0,
    } = req.query

    // Parse params
    query = lowerCase(query)
    path = path.split(',').map(field => field.trim())
    limit = clamp(limit, 0, 50) || 20
    skip = clamp(skip, 0, 1e3) || 0
    slop = clamp(slop, 0, 1e3) || 0

    // If the query is wrapped in quotes, search for an exact phrase
    const isExactPhrase = /^(".+")|('.+')$/.test(query)

    // The array of supported search fields
    const supportedFields = ['content', 'author', 'tags']

    if (!query) {
      // If query param is empty...
      return next(createError(422, 'Missing required parameter: `query`'))
    }

    if (path.some(field => !supportedFields.includes(field))) {
      // If the path param is invalid...
      return next(createError(422, 'Invalid parameter: `path`'))
    }

    // The search query
    // @see https://docs.atlas.mongodb.com/atlas-search/
    let $searchBeta

    if (isExactPhrase) {
      // Search for an exact phrase...
      // @see https://docs.atlas.mongodb.com/reference/atlas-search/phrase/
      $searchBeta = {
        phrase: { query, path, slop },
      }
    } else {
      // Otherwise, use text search...
      // @see https://docs.atlas.mongodb.com/reference/atlas-search/text/
      $searchBeta = {
        text: { query, path },
      }
    }

    // 1. Fetch a paginated set of results
    // 2. Count the total number of documents that match the query
    const [results, [{ totalCount = 0 } = {}]] = await Promise.all([
      Quote.aggregate([{ $searchBeta }, { $limit: limit }, { $skip: skip }]),
      Quote.aggregate([{ $searchBeta }, { $count: 'totalCount' }]),
    ])

    const count = results.length
    const lastItemIndex = skip + count < totalCount ? skip + count : null

    res.json({
      count: results.length,
      totalCount,
      lastItemIndex,
      results,
    })
  } catch (error) {
    return next(error)
  }
}
