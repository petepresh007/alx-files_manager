const crypto = require('crypto');
const database = require('../utils/db');
const redis = require('../utils/redis');

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

  static async getMe(req, res) {
    const token = req.header['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const key = `auth_${token}`;

    const userId = await redis.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const usersCollection = database.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error('Error retrieving user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UsersController;
