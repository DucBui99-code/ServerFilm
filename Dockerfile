# Sử dụng image Node.js chính thức
FROM node:18

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Expose cổng mà app sẽ chạy (ví dụ: 3000)
EXPOSE 8000

# Chạy ứng dụng
CMD ["node", "app.js"]
