const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { join } = require('path');
const fs = require('fs');
const redis = require('../utils/redis');
const database = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redis.get(`auth_${token}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
    }

    const allowedTypes = ['folder', 'file', 'image'];

    if (!type || !allowedTypes.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
    }

    let parent = null;
    if (parentId) {
      parent = await database.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    const file = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId: parent ? ObjectId(parentId) : 0,
    };
    if (type === 'folder') {
      const result = await database.db.collection('files').insertOne(file);

      return res.status(201).json({
        id: result.ops[0]._id,
        userId: result.ops[0].userId,
        name: result.ops[0].name,
        type: result.ops[0].type,
        isPublic: result.ops[0].isPublic,
        parentId: result.ops[0].parentId,
      });
    }

    const path = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }

    const uuid = uuidv4();
    const localPath = join(path, uuid);
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    file.localPath = localPath;
    const result = await database.db.collection('files').insertOne(file);

    return res.status(201).json({
      id: result.ops[0]._id,
      userId: result.ops[0].userId,
      name: result.ops[0].name,
      type: result.ops[0].type,
      isPublic: result.ops[0].isPublic,
      parentId: result.ops[0].parentId,
    });
  }
}

module.exports = FilesController;
