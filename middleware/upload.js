const multer = require('multer');
const { MAX_PHOTO_BYTES, IMAGE_SIGNATURES } = require('../config');

function invalidImageError() {
    const error = new Error('Only PNG, JPG and GIF images are allowed.');
    error.code = 'INVALID_IMAGE';
    return error;
}

function imageExtension(buffer) {
    const match = IMAGE_SIGNATURES.find(({ bytes }) => bytes.every((byte, i) => buffer[i] === byte));
    return match ? match.extension : null;
}

function isUploadError(err) {
    return err instanceof multer.MulterError || err.code === 'INVALID_IMAGE';
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(invalidImageError());
        }
        cb(null, true);
    },
});

module.exports = { upload, imageExtension, invalidImageError, isUploadError };
