const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.PASSWORD_EMAIL,
  },
});

const sendSGMail = async ({ to, subject, html, attachments }) => {
  try {
    await transporter.sendMail({
      from: process.env.USER_EMAIL, // sender address
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
