const bcrypt = require('bcrypt');
const database = require('../utils/db');

async function createUsers(req, res) {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).send('Missing email');
  }
  if (!password) {
    return res.status(400).send('Missing password');
  }

  const harshedPassword = await bcrypt.hash(password, 10);
  const userCollection = database.db.collection('users');

  const existingUser = await userCollection.findOne({ email });

  if (existingUser) {
    return res.status(400).send('Already exist');
  }
  const result = await userCollection.insertOne({ email, password: harshedPassword });

  return res.status(201).json({ email, id: result.insertedId });
}

module.exports = {
  createUsers,
};
