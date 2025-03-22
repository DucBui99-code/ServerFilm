const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

const isDevelopment = process.env.NODE_ENV === "development";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: isDevelopment
      ? process.env.DEV_USER_EMAIL
      : process.env.PRODUCTION_USER_EMAIL,
    pass: isDevelopment
      ? process.env.DEV_PASSWORD_EMAIL
      : process.env.PRODUCTION_PASSWORD_EMAIL,
  },
});

const sendSGMail = async ({ to, subject, html, attachments }) => {
  try {
    await transporter.sendMail({
      from: isDevelopment
        ? process.env.DEV_USER_EMAIL
        : process.env.PRODUCTION_USER_EMAIL, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      html: html, // html bod
    });
  } catch (err) {
    console.log(err);
  }
};

module.exports.sendEmail = async (args) => {
  if (!process.env.NODE_ENV === "development") {
    return Promise.resolve();
  } else {
    return sendSGMail(args);
  }
};
