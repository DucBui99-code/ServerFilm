module.exports = (name, password) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Recovery</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            margin: auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        h2 {
            color: #333;
            text-align: center;
        }
        p {
            font-size: 16px;
            color: #555;
        }
        .password-box {
            background: #e0e0e0;
            padding: 10px;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            border-radius: 4px;
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            font-size: 14px;
            color: #888;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Recovery</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your login credentials are as follows:</p>
        <p class="password-box">${password}</p>
        <p>For security reasons, please change your password after logging in.</p>
        <p>If you didn't request this email, please ignore it.</p>
        <div class="footer">
            <p>Best regards,<br>Support Team</p>
        </div>
    </div>
</body>
</html>
`;
};
