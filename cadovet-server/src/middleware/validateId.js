// `router.param('id', validateId)` turns "/pets/abc" or "/pets/1;DROP TABLE" into a clean 400 instead of a database
// error (and a 500 that leaks the SQL error text).
module.exports = (req, res, next, value) => {
  if (!/^[0-9]{1,9}$/.test(String(value)) || Number(value) < 1) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  next();
};
