const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { join } = require('path');
const fs = require('fs');
const mime = require('mime-types');
const redis = require('../utils/redis');
const database = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redis.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    const allowedTypes = ['folder', 'file', 'image'];

    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
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

  static async getShow(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redis.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const files = await database.db.collection('files').findOne({
      userId: new ObjectId(userId),
      _id: new ObjectId(id),
    });

    if (!files) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({
      id: files._id,
      userId: files.userId,
      name: files.name,
      type: files.type,
      isPublic: files.isPublic,
      parentId: files.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redis.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0 } = req.query;
    const page = 0;
    const pageSize = 20;
    const skip = page * pageSize;

    const query = {
      userId: new ObjectId(userId),
      parentId: parentId === 0 ? 0 : new ObjectId(parentId),
    };
    const files = await database.db.collection('files')
      .find(query)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    const data = files.map((data) => ({
      id: data._id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      isPublic: data.isPublic,
      parentId: data.parentId,
    }));

    return res.status(200).json(data);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redis.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const files = await database.db.collection('files').updateOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      },
      { $set: { isPublic: true } });

      if (!files) {
        return res.status(404).json({ error: 'Not found' });
      }

      const data = await database.db.collection('files').findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });

      return res.status(200).json({
        id: data._id,
        userId: data.userId,
        name: data.name,
        type: data.type,
        isPublic: data.isPublic,
        parentId: data.parentId,
      });
    } catch (error) {
      return res.status(500).json(error, 'internal server error');
    }
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redis.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const files = await database.db.collection('files').updateOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      },
      { $set: { isPublic: false } });

      if (!files) {
        return res.status(404).json({ error: 'Not found' });
      }

      const data = await database.db.collection('files').findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });

      return res.status(200).json({
        id: data._id,
        userId: data.userId,
        name: data.name,
        type: data.type,
        isPublic: data.isPublic,
        parentId: data.parentId,
      });
    } catch (error) {
      return res.status(500).json(error, 'internal server error');
    }
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;

    const userId = await redis.get(`auth_${token}`);

    const file = await database.db.collection('files').findOne({
      _id: new ObjectId(id),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type !== 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    const { isPublic } = file;

    if (!isPublic && (!token || !userId || userId !== file.userId.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    const fileContent = fs.readFileSync(file.localPath);

    res.setHeader('Content-Type', mimeType);
    return res.status(200).send(fileContent);
  }
}

module.exports = FilesController;
