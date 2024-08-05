const crypto = require('crypto');
const database = require('../utils/db');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const harshedPassword = crypto.createHash('sha1').update(password).digest('hex');
    const userCollection = database.db.collection('users');

    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const result = await userCollection.insertOne({ email, password: harshedPassword });

    return res.status(201).json({ id: result.insertedId, email });
  }
}

module.exports = UsersController;
