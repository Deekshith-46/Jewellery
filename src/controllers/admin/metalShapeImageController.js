const MetalShapeImage = require('../../models/admin/MetalShapeImage');
const MetalShapeImageImages = require('../../models/admin/MetalShapeImageImages');
const cloudinary = require('../../config/cloudinary');
const streamifier = require('streamifier');

function uploadBufferToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const opts = { folder };
    if (publicId) opts.public_id = publicId;
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

exports.uploadMetalShapeImages = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { metalId, shapeId, altFront, altTop, altHand, altDiagram } = req.body;
    if (!metalId || !shapeId) {
      return res.status(400).json({ message: 'metalId and shapeId are required' });
    }
    const files = req.files || {};
    const expected = ['front', 'top', 'hand', 'diagram'];
    const images = {};
    for (const key of expected) {
      if (files[key] && files[key][0]) {
        const file = files[key][0];
        const folder = `products/${productId}/metalshape`;
        const publicId = `${productId}_${metalId}_${shapeId}_${key}`;
        const uploadRes = await uploadBufferToCloudinary(file.buffer, folder, publicId);
        images[key] = { url: uploadRes.secure_url, public_id: uploadRes.public_id };
      }
    }
    const primarySet = {};
    if (images.front) primarySet.image = images.front;
    const primary = await MetalShapeImage.findOneAndUpdate(
      { productId, metalId, shapeId },
      { productId, metalId, shapeId, ...(primarySet.image ? { image: primarySet.image } : {}) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const imagesDoc = await MetalShapeImageImages.findOneAndUpdate(
      { metalShapeImageId: primary._id },
      {
        metalShapeImageId: primary._id,
        ...(images.front ? { front: images.front } : {}),
        ...(images.top ? { top: images.top } : {}),
        ...(images.hand ? { hand: images.hand } : {}),
        ...(images.diagram ? { diagram: images.diagram } : {}),
        altText: { front: altFront || '', top: altTop || '', hand: altHand || '', diagram: altDiagram || '' }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ primary, images: imagesDoc });
  } catch (err) { next(err); }
};

exports.deleteByProductMetalShape = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { metalId, shapeId } = req.body;
    if (!metalId || !shapeId) return res.status(400).json({ message: 'metalId and shapeId required' });
    const doc = await MetalShapeImage.findOneAndDelete({ productId, metalId, shapeId });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const imagesDoc = await MetalShapeImageImages.findOneAndDelete({ metalShapeImageId: doc._id });
    const toDelete = [];
    if (doc.image && doc.image.public_id) toDelete.push(doc.image.public_id);
    if (imagesDoc) {
      ['front', 'top', 'hand', 'diagram'].forEach(k => {
        if (imagesDoc[k] && imagesDoc[k].public_id) toDelete.push(imagesDoc[k].public_id);
      });
    }
    await Promise.all(toDelete.map(pid => cloudinary.uploader.destroy(pid).catch(() => {})));
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};


