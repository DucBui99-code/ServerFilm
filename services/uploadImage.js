// uploadImage.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config({ path: "../config.env" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createUploader = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
    },
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Giới hạn 2MB
  }).fields([{ name: "avatar", maxCount: 1 }]);
};

module.exports = { createUploader };
